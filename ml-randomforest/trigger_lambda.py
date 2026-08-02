import boto3
import json
import os
import pg8000
from ml_model import DQMachineLearningModel, MODEL_PATH, ENCODER_PATH

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
    
    if not os.path.exists(tmp_model_path) or not os.path.exists(tmp_encoder_path):
        print("Downloading ML model from S3...")
        s3 = boto3.client('s3')
        try:
            s3.download_file(S3_BUCKET, "dq_rf_model.pkl", tmp_model_path)
            s3.download_file(S3_BUCKET, "dq_type_encoder.pkl", tmp_encoder_path)
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
        local_model_rules = []
        
        # 3. Predict using local ML model
        for r in profiles_raw:
            table_name, column_name, data_type, total_rows, null_rate, distinct_rate, min_length, max_length = r
            if (table_name, column_name) in handled_columns:
                continue
                
            profile_dict = {
                "table_name": table_name, "column_name": column_name, "data_type": data_type,
                "total_rows": total_rows, "null_rate": null_rate, "distinct_rate": distinct_rate,
                "min_length": min_length, "max_length": max_length
            }
            
            if model and model.is_loaded:
                rules = model.predict(profile_dict)
                if rules:
                    local_model_rules.extend(rules)
                    handled_columns.add((table_name, column_name))
                else:
                    unhandled_profiles.append(profile_dict)
            else:
                unhandled_profiles.append(profile_dict)
                
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
        if unhandled_profiles:
            print(f"There are {len(unhandled_profiles)} unhandled profiles. Triggering AWS Bedrock Agent...")
            client = boto3.client('bedrock-agentcore', region_name='ap-south-1')
            agent_arn = "arn:aws:bedrock-agentcore:ap-south-1:413612133806:runtime/dq_agent_runtime-4OD3OK5P9R"
            
            response = client.invoke_agent_runtime(
                agentRuntimeArn=agent_arn,
                payload=json.dumps({"action": "generate_rules"})
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
