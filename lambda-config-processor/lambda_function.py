import json
import os
import boto3
import pg8000
import tempfile
import urllib.parse
from PyPDF2 import PdfReader

s3_client = boto3.client('s3')

def get_db_connection():
    return pg8000.connect(
        host=os.environ.get("DB_HOST"),
        port=int(os.environ.get("DB_PORT", "5432")),
        database=os.environ.get("DB_NAME"),
        user=os.environ.get("DB_USER"),
        password=os.environ.get("DB_PASSWORD"),
        ssl_context=True
    )

def save_custom_config(config_text: str):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS dq_custom_configs (
            id SERIAL PRIMARY KEY,
            config_text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        INSERT INTO dq_custom_configs (config_text)
        VALUES (%s)
    """, (config_text,))
    conn.commit()
    conn.close()

def lambda_handler(event, context):
    print("Received event:", json.dumps(event))
    try:
        # Check if this is an API Gateway event (Plain text upload)
        if 'httpMethod' in event or 'routeKey' in event:
            body = json.loads(event.get('body', '{}'))
            config_text = body.get('config_text')
            
            if not config_text:
                raise ValueError("config_text is required for direct API calls")
                
            save_custom_config(config_text)
            
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Methods": "OPTIONS,POST"
                },
                "body": json.dumps({"message": "Configuration saved successfully from text"})
            }
            
        # Check if this is an S3 Event (PDF upload)
        elif 'Records' in event and event['Records'][0].get('eventSource') == 'aws:s3':
            for record in event['Records']:
                bucket = record['s3']['bucket']['name']
                key = urllib.parse.unquote_plus(record['s3']['object']['key'])
                
                print(f"Processing s3://{bucket}/{key}")
                
                with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tmp_file:
                    tmp_path = tmp_file.name
                
                s3_client.download_file(bucket, key, tmp_path)
                
                # Extract text based on file type
                extracted_text = ""
                if key.lower().endswith(".pdf"):
                    reader = PdfReader(tmp_path)
                    for page in reader.pages:
                        text = page.extract_text()
                        if text:
                            extracted_text += text + "\n"
                elif key.lower().endswith(".txt"):
                    with open(tmp_path, "r", encoding="utf-8") as f:
                        extracted_text = f.read()
                        
                os.remove(tmp_path)
                
                if extracted_text.strip():
                    save_custom_config(extracted_text)
                    print(f"Successfully saved configuration from {key}")
                else:
                    print(f"No text extracted from {key}")
                    
            return {"statusCode": 200, "body": json.dumps("Processed S3 event successfully")}
            
        else:
            return {"statusCode": 400, "body": json.dumps("Unknown event type")}
            
    except Exception as e:
        import traceback
        print("Error:", traceback.format_exc())
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            "body": json.dumps({"error": str(e)})
        }
