import boto3
import json
import os
import pg8000
import pandas as pd
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

def lambda_handler(event, context):
    print("Starting ML Model Training Job...")
    conn = get_connection()
    cur = conn.cursor()
    
    try:
        # Fetch historical approved rules joined with profiles
        query = """
            SELECT 
                p.total_rows, p.null_rate, p.distinct_rate, 
                p.min_length, p.max_length, p.data_type,
                r.rule_type as target_rule_type
            FROM dq_profiles p
            JOIN dq_rules r ON p.table_name = r.table_name AND p.column_name = r.column_name
        """
        cur.execute(query)
        rows = cur.fetchall()
        
        if len(rows) < 100:
            return {"statusCode": 200, "message": f"Only {len(rows)} approved rules found. Not enough data to train."}
            
        # Convert to DataFrame
        columns = ['total_rows', 'null_rate', 'distinct_rate', 'min_length', 'max_length', 'data_type', 'target_rule_type']
        df = pd.DataFrame(rows, columns=columns)
        
        print(f"Training on {len(df)} historical records...")
        
        # Train model
        model = DQMachineLearningModel(confidence_threshold=0.85)
        model.train(df)
        
        # Upload to S3
        s3 = boto3.client('s3')
        s3.upload_file(MODEL_PATH, S3_BUCKET, "dq_rf_model.pkl")
        s3.upload_file(ENCODER_PATH, S3_BUCKET, "dq_type_encoder.pkl")
        
        print("Model successfully trained and uploaded to S3!")
        return {"statusCode": 200, "message": "Training successful", "records_trained": len(df)}
        
    except Exception as e:
        print(f"Error training model: {e}")
        return {"statusCode": 500, "message": str(e)}
    finally:
        conn.close()
