import json
import os
import boto3
import pg8000

def get_connection():
    return pg8000.connect(
        host=os.environ.get("DB_HOST"),
        port=int(os.environ.get("DB_PORT", 5432)),
        database=os.environ.get("DB_NAME"),
        user=os.environ.get("DB_USER"),
        password=os.environ.get("DB_PASSWORD")
    )

def check_custom_configs():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM dq_custom_configs")
        count = cur.fetchone()[0]
        conn.close()
        return count > 0
    except Exception as e:
        print(f"Error checking configs: {e}")
        return False

def lambda_handler(event, context):
    print("Executing Orchestrator Trigger...")
    try:
        client = boto3.client('bedrock-agentcore', region_name='us-east-1')
        
        has_configs = check_custom_configs()
        
        if has_configs:
            print("Custom configs found. Routing to Agent 1 (Pure LLM).")
            agent_arn = os.environ.get("AGENT_1_ARN")
            payload = {"action": "generate_rules"}
        else:
            print("No custom configs. Routing to Agent 2 (Hybrid Engine).")
            agent_arn = os.environ.get("AGENT_2_ARN")
            payload = {"action": "generate_rules"}
            
        print(f"Invoking agent: {agent_arn}")
        
        response = client.invoke_agent_runtime(
            agentRuntimeArn=agent_arn,
            payload=json.dumps(payload)
        )
        
        parsed_response = json.loads(response['response'].read())
        
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            "body": json.dumps({
                "status": "success",
                "agent_response": parsed_response,
                "routed_to": "Agent 1 (LLM)" if has_configs else "Agent 2 (Hybrid)"
            })
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error in orchestrator: {e}")
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            "body": json.dumps({"status": "error", "message": str(e)})
        }
