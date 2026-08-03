import json
import urllib.request
import os

def lambda_handler(event, context):
    agentcore_url = os.environ.get("AGENTCORE_URL")
    
    if not agentcore_url:
        return {
            'statusCode': 500,
            'body': json.dumps('AGENTCORE_URL environment variable is missing!')
        }
    
    # Ensure the URL points to /invocations
    if not agentcore_url.endswith("/invocations"):
        agentcore_url = agentcore_url.rstrip("/") + "/invocations"
        
    try:
        # Make a POST request to the AgentCore runtime
        req = urllib.request.Request(
            agentcore_url,
            data=json.dumps({}).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            response_body = response.read().decode('utf-8')
            
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Successfully triggered AgentCore!',
                'agent_response': json.loads(response_body) if response_body else None
            })
        }
        
    except Exception as e:
        print(f"Error triggering AgentCore: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Failed to trigger AgentCore: {str(e)}")
        }
