$ErrorActionPreference = "Stop"
$env:AWS_DEFAULT_REGION = "us-east-1"

$AccountId = (aws sts get-caller-identity --query Account --output text)
$Region = "us-east-1"
$BucketName = "dq-custom-configs-bucket-1696417599"

Write-Host "1. Creating IAM Role..."
$TrustPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
"@
Set-Content -Path trust-policy.json -Value $TrustPolicy

$RoleArn = ""
try {
    $Role = aws iam create-role --role-name dq-custom-config-lambda-role --assume-role-policy-document file://trust-policy.json | ConvertFrom-Json
    $RoleArn = $Role.Role.Arn
    Write-Host "Waiting for role to propagate..."
    Start-Sleep -Seconds 10
} catch {
    Write-Host "Role may already exist, fetching ARN..."
    $RoleArn = (aws iam get-role --role-name dq-custom-config-lambda-role --query Role.Arn --output text)
}

aws iam attach-role-policy --role-name dq-custom-config-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

$InlinePolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::${BucketName}/*"
    }
  ]
}
"@
Set-Content -Path s3-policy.json -Value $InlinePolicy
aws iam put-role-policy --role-name dq-custom-config-lambda-role --policy-name S3AccessPolicy --policy-document file://s3-policy.json

Write-Host "2. Deploying Lambdas..."
# Presigned URL Lambda
try {
    aws lambda create-function --function-name lambda-presigned-url `
        --runtime python3.9 --handler lambda_function.lambda_handler `
        --role $RoleArn --zip-file fileb://lambda-presigned-url.zip `
        --environment "Variables={BUCKET_NAME=$BucketName}" --timeout 15 | Out-Null
    Write-Host "Created lambda-presigned-url"
} catch {
    Write-Host "lambda-presigned-url already exists, updating..."
    aws lambda update-function-code --function-name lambda-presigned-url --zip-file fileb://lambda-presigned-url.zip | Out-Null
    aws lambda update-function-configuration --function-name lambda-presigned-url --environment "Variables={BUCKET_NAME=$BucketName}" | Out-Null
}

# Config Processor Lambda
$DbHost = "postgres.cqbucwq2y92h.us-east-1.rds.amazonaws.com"
$DbPort = "5432"
$DbName = "postgres"
$DbUser = "postgres"
$DbPassword = "YourPassword123!"

try {
    aws lambda create-function --function-name lambda-config-processor `
        --runtime python3.9 --handler lambda_function.lambda_handler `
        --role $RoleArn --zip-file fileb://lambda-config-processor.zip `
        --environment "Variables={DB_HOST=$DbHost,DB_PORT=$DbPort,DB_NAME=$DbName,DB_USER=$DbUser,DB_PASSWORD=$DbPassword}" --timeout 60 | Out-Null
    Write-Host "Created lambda-config-processor"
} catch {
    Write-Host "lambda-config-processor already exists, updating..."
    aws lambda update-function-code --function-name lambda-config-processor --zip-file fileb://lambda-config-processor.zip | Out-Null
    aws lambda update-function-configuration --function-name lambda-config-processor --environment "Variables={DB_HOST=$DbHost,DB_PORT=$DbPort,DB_NAME=$DbName,DB_USER=$DbUser,DB_PASSWORD=$DbPassword}" | Out-Null
}

$ProcessorArn = (aws lambda get-function --function-name lambda-config-processor --query Configuration.FunctionArn --output text)

Write-Host "3. Configuring S3 Triggers..."
try {
    aws lambda add-permission --function-name lambda-config-processor --statement-id s3-trigger `
        --action "lambda:InvokeFunction" --principal s3.amazonaws.com `
        --source-arn arn:aws:s3:::$BucketName --source-account $AccountId | Out-Null
} catch {
    Write-Host "S3 permission already exists."
}

$NotificationConfig = @"
{
  "LambdaFunctionConfigurations": [
    {
      "LambdaFunctionArn": "${ProcessorArn}",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            { "Name": "suffix", "Value": ".pdf" }
          ]
        }
      }
    }
  ]
}
"@
Set-Content -Path notification.json -Value $NotificationConfig
aws s3api put-bucket-notification-configuration --bucket $BucketName --notification-configuration file://notification.json

Write-Host "4. Creating API Gateway..."
$ApiId = ""
try {
    $ApiData = aws apigatewayv2 create-api --name dq-custom-configs-api --protocol-type HTTP | ConvertFrom-Json
    $ApiId = $ApiData.ApiId
    Write-Host "Created API Gateway: $ApiId"
} catch {
    Write-Host "Failed to create API Gateway"
    exit 1
}

$PresignedArn = (aws lambda get-function --function-name lambda-presigned-url --query Configuration.FunctionArn --output text)

# Add permissions for API Gateway
try { aws lambda add-permission --function-name lambda-presigned-url --statement-id apigw-trigger --action "lambda:InvokeFunction" --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:${AccountId}:${ApiId}/*" | Out-Null } catch {}
try { aws lambda add-permission --function-name lambda-config-processor --statement-id apigw-trigger --action "lambda:InvokeFunction" --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:${AccountId}:${ApiId}/*" | Out-Null } catch {}

# Integrations
$IntPresigned = aws apigatewayv2 create-integration --api-id $ApiId --integration-type AWS_PROXY --integration-uri $PresignedArn --payload-format-version 2.0 | ConvertFrom-Json
$IntProcessor = aws apigatewayv2 create-integration --api-id $ApiId --integration-type AWS_PROXY --integration-uri $ProcessorArn --payload-format-version 2.0 | ConvertFrom-Json

# Routes
aws apigatewayv2 create-route --api-id $ApiId --route-key "POST /presigned" --target "integrations/$($IntPresigned.IntegrationId)" | Out-Null
aws apigatewayv2 create-route --api-id $ApiId --route-key "POST /configs" --target "integrations/$($IntProcessor.IntegrationId)" | Out-Null

# Stage
aws apigatewayv2 create-stage --api-id $ApiId --stage-name '$default' --auto-deploy | Out-Null

$ApiUrl = "https://${ApiId}.execute-api.${Region}.amazonaws.com"
Write-Host "API Gateway URL: $ApiUrl"

Write-Host "5. Updating frontend/.env.local..."
$EnvPath = "frontend/.env.local"
$EnvContent = Get-Content $EnvPath
$EnvContent += "`nNEXT_PUBLIC_PRESIGNED_URL_API=$ApiUrl/presigned"
$EnvContent += "`nNEXT_PUBLIC_PROCESSOR_API=$ApiUrl/configs"
Set-Content -Path $EnvPath -Value $EnvContent

Write-Host "Deployment Complete!"
