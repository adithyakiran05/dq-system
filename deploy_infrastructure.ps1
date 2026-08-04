param (
    [string]$BucketName = "dq-custom-configs-bucket-$(Get-Random)",
    [string]$Region = "us-east-1"
)

Write-Host "Starting AWS Infrastructure Deployment..."

# 1. Create S3 Bucket
Write-Host "Creating S3 Bucket: $BucketName"
aws s3 mb s3://$BucketName --region $Region

# 2. Package Lambda 1 (Presigned URL)
Write-Host "Packaging Presigned URL Lambda..."
Compress-Archive -Path .\lambda-presigned-url\lambda_function.py -DestinationPath .\lambda-presigned-url.zip -Force

# 3. Package Lambda 2 (Config Processor)
Write-Host "Packaging Config Processor Lambda (Note: requires dependencies to be installed)..."
# Typically you would pip install -r requirements.txt -t . inside the folder before zipping
pip install -r .\lambda-config-processor\requirements.txt -t .\lambda-config-processor\
Compress-Archive -Path .\lambda-config-processor\* -DestinationPath .\lambda-config-processor.zip -Force

Write-Host "========================================================"
Write-Host "Packages created successfully!"
Write-Host "Next steps for deployment:"
Write-Host "1. Create an IAM Role with S3 and RDS access."
Write-Host "2. Deploy the lambdas using AWS Console or CLI using the zip files."
Write-Host "3. Set the BUCKET_NAME environment variable on the presigned URL lambda to $BucketName."
Write-Host "4. Set the DB_* environment variables on the config processor lambda."
Write-Host "5. Configure S3 to trigger the config processor lambda on ObjectCreated events."
Write-Host "6. Create an API Gateway for both lambdas and update the NEXT_PUBLIC_ URLs in your frontend .env.local file."
Write-Host "========================================================"
