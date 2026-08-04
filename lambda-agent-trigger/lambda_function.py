import json
import os
import boto3

def lambda_handler(event, context):
    print("Executing Simple Agent Trigger...")
    try:
        client = boto3.client('bedrock-agentcore', region_name='us-east-1')
        agent_arn = os.environ.get("AGENT_ARN", "arn:aws:bedrock-agentcore:us-east-1:413612133806:runtime/dq_agent-VW5g8m2yNy")
        
        # We pass the payload instructing the agent to start generating rules
        response = client.invoke_agent_runtime(
            agentRuntimeArn=agent_arn,
            payload=json.dumps({"action": "generate_rules"})
        )
        
        # Read and parse the stream response from the AWS client
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
                "agent_response": parsed_response
            })
        }
    except Exception as e:
        print(f"Error triggering AgentCore: {e}")
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            "body": json.dumps({"status": "error", "message": str(e)})
        }
