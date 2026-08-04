import json
import os
import boto3
import uuid

def lambda_handler(event, context):
    try:
        s3_client = boto3.client('s3')
        bucket_name = os.environ.get('BUCKET_NAME')
        
        if not bucket_name:
            raise Exception("BUCKET_NAME environment variable not set")
            
        body = json.loads(event.get('body', '{}'))
        filename = body.get('filename', f"{uuid.uuid4()}.pdf")
        content_type = body.get('contentType', 'application/pdf')
        
        object_key = f"uploads/{uuid.uuid4()}-{filename}"
        
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
                'Key': object_key,
                'ContentType': content_type
            },
            ExpiresIn=3600
        )
        
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST"
            },
            "body": json.dumps({
                "url": presigned_url,
                "key": object_key
            })
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            "body": json.dumps({"error": str(e)})
        }
