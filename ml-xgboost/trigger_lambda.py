import boto3
import json
import os
import pg8000
import httpx
from groq import Groq
from ml_model import DQMachineLearningModel, MODEL_PATH, ENCODER_PATH, TARGET_ENCODER_PATH

S3_BUCKET = os.environ.get("S3_MODEL_BUCKET", "dq-agent-models-bucket")

def get_connection():
    return pg8000.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", 5432)),
        database=os.environ.get("DB_NAME", "postgres"),
        user=os.environ.get("DB_USER", "postgres"),
        password=os.environ.get("DB_PASSWORD", "postgres")
    )

def download_model_from_s3():
    """Downloads model files from S3 to /tmp/ if they don't exist yet"""
    tmp_model_path = MODEL_PATH
    tmp_encoder_path = ENCODER_PATH
    tmp_target_encoder_path = TARGET_ENCODER_PATH
    
    if not os.path.exists(tmp_model_path) or not os.path.exists(tmp_encoder_path) or not os.path.exists(tmp_target_encoder_path):
        print("Downloading ML model from S3...")
        s3 = boto3.client('s3')
        try:
            s3.download_file(S3_BUCKET, "dq_xgb_model.pkl", tmp_model_path)
            s3.download_file(S3_BUCKET, "dq_type_encoder.pkl", tmp_encoder_path)
            s3.download_file(S3_BUCKET, "dq_target_encoder.pkl", tmp_target_encoder_path)
        except Exception as e:
            print(f"S3 model not found or error: {e}. Will fall back to Agent.")
            return False
            
    return True

def lambda_handler(event, context):
    print("Executing S3-Backed Smart Trigger...")
    
    has_model = download_model_from_s3()
    model = DQMachineLearningModel(confidence_threshold=0.85) if has_model else None
    
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # 1. Fetch all profiles
        cur.execute("SELECT table_name, column_name, data_type, total_rows, null_rate, distinct_rate, min_length, max_length FROM dq_profiles")
        profiles_raw = cur.fetchall()
        
        # 2. Find which columns already have rules
        cur.execute("SELECT DISTINCT table_name, column_name FROM dq_rules_proposed")
        proposed = set((r[0], r[1]) for r in cur.fetchall())
        
        cur.execute("SELECT DISTINCT table_name, column_name FROM dq_rules")
        active = set((r[0], r[1]) for r in cur.fetchall())
        handled_columns = proposed.union(active)
        
        unhandled_profiles = []
        agent_payload_profiles = []
        local_model_rules = []
        
        # 3. Predict using local ML model
        # Gather profiles first
        pending_profiles = []
        for r in profiles_raw:
            table_name, column_name, data_type, total_rows, null_rate, distinct_rate, min_length, max_length = r
            if (table_name, column_name) in handled_columns:
                continue
                
            profile_dict = {
                "table_name": table_name, "column_name": column_name, "data_type": data_type,
                "total_rows": total_rows, "null_rate": null_rate, "distinct_rate": distinct_rate,
                "min_length": min_length, "max_length": max_length
            }
            pending_profiles.append(profile_dict)
            
        # Fetch user constraints
        cur.execute("SELECT table_name, column_name, constraint_text FROM dq_user_constraints")
        constraints_raw = cur.fetchall()
        user_constraints = {f"{r[0]}.{r[1]}": r[2] for r in constraints_raw}
        
        # Route using Groq LLM
        http_client = httpx.Client(verify=False)
        groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"), http_client=http_client)
        
        # Only route if we have pending profiles
        if pending_profiles:
            try:
                system_prompt = """
                You are a routing agent for a data quality system. For each column profile provided, classify if rule generation should be routed to "ML" (for standard numeric/text columns without specific constraints) or "AGENT" (for complex columns, unstructured text, or if there is a specific user constraint). 
                Return a JSON dict mapping 'table_name.column_name' to either "ML" or "AGENT".
                """
                # Prepare a summary payload to save tokens
                routing_payload = []
                for p in pending_profiles:
                    key = f"{p['table_name']}.{p['column_name']}"
                    routing_payload.append({
                        "id": key,
                        "data_type": p['data_type'],
                        "has_constraint": key in user_constraints,
                        "constraint": user_constraints.get(key, "")
                    })
                
                chat_completion = groq_client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": json.dumps(routing_payload)}
                    ],
                    model="llama-3.1-8b-instant",
                    temperature=0.1,
                    response_format={"type": "json_object"}
                )
                
                routing_decisions = json.loads(chat_completion.choices[0].message.content)
            except Exception as e:
                print(f"Routing failed, defaulting to ML: {e}")
                routing_decisions = {}
        else:
            routing_decisions = {}
            
        # Process routed profiles
        for p in pending_profiles:
            key = f"{p['table_name']}.{p['column_name']}"
            route = routing_decisions.get(key, "ML")
            
            # Attach constraint to the profile if present
            if key in user_constraints:
                p["user_constraint"] = user_constraints[key]
            
            if route == "ML" and model and model.is_loaded:
                rules = model.predict(p)
                if rules:
                    local_model_rules.extend(rules)
                    handled_columns.add((p['table_name'], p['column_name']))
                else:
                    agent_payload_profiles.append(p)
            else:
                agent_payload_profiles.append(p)
                
        # 4. Insert confident ML rules
        if local_model_rules:
            print(f"ML Model generated {len(local_model_rules)} rules. Inserting...")
            for rule in local_model_rules:
                cur.execute("""
                    INSERT INTO dq_rules_proposed(
                        table_name, column_name, rule_type, rule_config, severity, confidence, generated_by, dq_type
                    ) VALUES (%s, %s, %s, %s, %s, %s, 'ml-model', 'general')
                """, (
                    rule["table_name"], rule["column_name"], rule["rule_type"], 
                    json.dumps(rule["rule_config"]), rule["severity"], rule["confidence"]
                ))
            conn.commit()
            
        # 5. Fallback to Agent if there are still unhandled profiles
        if agent_payload_profiles:
            print(f"There are {len(agent_payload_profiles)} profiles routed to the Agent. Triggering AWS Bedrock Agent...")
            client = boto3.client('bedrock-agentcore', region_name='ap-south-1')
            agent_arn = "arn:aws:bedrock-agentcore:ap-south-1:413612133806:runtime/dq_agent_runtime-4OD3OK5P9R"
            
            response = client.invoke_agent_runtime(
                agentRuntimeArn=agent_arn,
                payload=json.dumps({
                    "action": "generate_rules",
                    "profiles": agent_payload_profiles
                })
            )
            parsed_response = json.loads(response['response'].read())
        else:
            parsed_response = {"status": "skipped", "message": "All handled by ML model"}
            
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            "body": json.dumps({
                "status": "success",
                "ml_rules_generated": len(local_model_rules),
                "agent_invoked": len(unhandled_profiles) > 0,
                "agent_response": parsed_response
            })
        }
        
    except Exception as e:
        print(f"Error in Smart Trigger: {e}")
        try: conn.rollback()
        except: pass
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            "body": json.dumps({"status": "error", "message": str(e)})
        }
    finally:
        conn.close()
