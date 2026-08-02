import boto3
import json

def lambda_handler(event, context):
    print("Triggering the Agent Runtime...")
    
    # Initialize the Bedrock AgentCore client
    client = boto3.client('bedrock-agentcore', region_name='ap-south-1')
    
    # Update this with your actual dq_agent_runtime ARN from the AWS console
    agent_arn = "arn:aws:bedrock-agentcore:ap-south-1:413612133806:runtime/dq_agent_runtime-4OD3OK5P9R"
    
    try:
        response = client.invoke_agent_runtime(
            agentRuntimeArn=agent_arn,
            payload=json.dumps({"action": "generate_rules"})
        )
        
        response_body = response['response'].read()
        parsed_response = json.loads(response_body)
        print("Agent Response:", parsed_response)
        
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST"
            },
            "body": json.dumps({
                "status": "success",
                "message": "Agent triggered successfully",
                "data": parsed_response
            })
        }
        
    except Exception as e:
        print(f"Error invoking agent: {e}")
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST"
            },
            "body": json.dumps({
                "status": "error",
                "message": str(e)
            })
        }
