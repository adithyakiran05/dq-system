import json
import uuid
import logging
import boto3
from botocore.exceptions import ClientError, BotoCoreError
import httpx
from app.config import settings

logger = logging.getLogger("middleware.aws")

class AWSService:
    def __init__(self):
        self.region = settings.AWS_REGION
        self.s3_client = None
        self.lambda_client = None
        
        try:
            self.s3_client = boto3.client("s3", region_name=self.region)
            self.lambda_client = boto3.client("lambda", region_name=self.region)
        except Exception as e:
            logger.warning(f"AWS Boto3 initialization notice: {e}")

    def generate_presigned_upload_url(self, filename: str = None, content_type: str = "application/pdf") -> dict:
        """
        Generates an S3 presigned URL for direct secure file upload from client to S3 bucket.
        """
        if not filename:
            filename = f"{uuid.uuid4()}.pdf"
            
        object_key = f"uploads/{uuid.uuid4()}-{filename}"
        
        try:
            if not self.s3_client:
                self.s3_client = boto3.client("s3", region_name=self.region)
                
            presigned_url = self.s3_client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": settings.S3_BUCKET_NAME,
                    "Key": object_key,
                    "ContentType": content_type
                },
                ExpiresIn=3600
            )
            return {
                "url": presigned_url,
                "key": object_key,
                "bucket": settings.S3_BUCKET_NAME
            }
        except Exception as e:
            logger.error(f"Failed to generate presigned S3 URL: {e}")
            raise RuntimeError(f"Could not generate S3 upload URL: {str(e)}")

    def invoke_lambda_async(self, function_name: str, payload: dict = None) -> dict:
        """
        Invokes an AWS Lambda function asynchronously (Event-driven).
        """
        if payload is None:
            payload = {}
            
        try:
            if not self.lambda_client:
                self.lambda_client = boto3.client("lambda", region_name=self.region)

            response = self.lambda_client.invoke(
                FunctionName=function_name,
                InvocationType="Event",
                Payload=json.dumps(payload).encode("utf-8")
            )
            return {
                "status": "success",
                "function": function_name,
                "statusCode": response.get("StatusCode", 202)
            }
        except (ClientError, BotoCoreError) as e:
            logger.error(f"AWS Lambda invoke error on {function_name}: {e}")
            raise RuntimeError(f"Failed to trigger {function_name}: {str(e)}")

    async def trigger_agent(self, tenant_id: str) -> dict:
        """
        Triggers the DQ Agent / Bedrock runtime.
        If AGENT_TRIGGER_API_URL is configured, triggers via HTTP endpoint.
        Otherwise triggers the Lambda Agent Trigger via boto3.
        """
        if settings.AGENT_TRIGGER_API_URL:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        settings.AGENT_TRIGGER_API_URL,
                        json={"tenant_id": tenant_id}
                    )
                    return resp.json() if resp.status_code == 200 else {"status": "triggered"}
            except Exception as e:
                logger.warning(f"HTTP agent trigger failed, falling back to Lambda: {e}")

        # Fallback to direct Lambda trigger
        return self.invoke_lambda_async(
            settings.LAMBDA_AGENT_TRIGGER_NAME,
            {"tenant_id": tenant_id}
        )

aws_service = AWSService()
