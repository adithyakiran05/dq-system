import boto3
import json

# Initialize the Bedrock AgentCore client
client = boto3.client('bedrock-agentcore', region_name='ap-south-1')

def invoke_my_agent():
    print("Triggering the Agent Runtime...")
    
    # 1. Update this with your actual dq_agent_runtime ARN from the AWS console
    agent_arn = "arn:aws:bedrock-agentcore:ap-south-1:413612133806:runtime/dq_agent_runtime-4OD3OK5P9R"
    
    try:
        response = client.invoke_agent_runtime(
            agentRuntimeArn=agent_arn,
            # For a basic HTTP trigger, an empty payload is fine.
            payload=json.dumps({"action": "generate_rules"})
        )
        
        response_body = response['response'].read()
        print("Agent Response:")
        print(json.loads(response_body))
        
    except Exception as e:
        print(f"Error invoking agent: {e}")

if __name__ == "__main__":
    invoke_my_agent()
