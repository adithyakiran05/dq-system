$ErrorActionPreference = "Stop"
$env:AWS_DEFAULT_REGION = "us-east-1"
$AccountId = (aws sts get-caller-identity --query Account --output text)
$Region = "us-east-1"

Write-Host "1. Installing dependencies..."
cd lambda-orchestrator-trigger
pip install pg8000 -t .

Write-Host "2. Zipping deployment package..."
Compress-Archive -Path * -DestinationPath ../lambda-orchestrator.zip -Force
cd ..

Write-Host "3. Deploying Orchestrator Lambda..."
$RoleArn = (aws iam get-role --role-name dq-custom-config-lambda-role --query Role.Arn --output text)

$DbHost = if ($env:DB_HOST) { $env:DB_HOST } else { "your-rds-endpoint.amazonaws.com" }
$DbPort = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
$DbName = if ($env:DB_NAME) { $env:DB_NAME } else { "postgres" }
$DbUser = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
$DbPassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "your-db-password" }
$Agent1Arn = if ($env:AGENT_1_ARN) { $env:AGENT_1_ARN } else { "arn:aws:bedrock-agentcore:${Region}:${AccountId}:runtime/agent_1" }
$Agent2Arn = if ($env:AGENT_2_ARN) { $env:AGENT_2_ARN } else { "arn:aws:bedrock-agentcore:${Region}:${AccountId}:runtime/agent_2" }

try {
    aws lambda create-function --function-name lambda-orchestrator-trigger `
        --runtime python3.12 --handler lambda_function.lambda_handler `
        --role $RoleArn --zip-file fileb://lambda-orchestrator.zip `
        --environment "Variables={DB_HOST=$DbHost,DB_PORT=$DbPort,DB_NAME=$DbName,DB_USER=$DbUser,DB_PASSWORD=$DbPassword,AGENT_1_ARN=$Agent1Arn,AGENT_2_ARN=$Agent2Arn}" --timeout 30 | Out-Null
    Write-Host "Created lambda-orchestrator-trigger"
} catch {
    Write-Host "lambda-orchestrator-trigger already exists, updating..."
    aws lambda update-function-code --function-name lambda-orchestrator-trigger --zip-file fileb://lambda-orchestrator.zip | Out-Null
    aws lambda update-function-configuration --function-name lambda-orchestrator-trigger --environment "Variables={DB_HOST=$DbHost,DB_PORT=$DbPort,DB_NAME=$DbName,DB_USER=$DbUser,DB_PASSWORD=$DbPassword,AGENT_1_ARN=$Agent1Arn,AGENT_2_ARN=$Agent2Arn}" | Out-Null
}

$OrchestratorArn = (aws lambda get-function --function-name lambda-orchestrator-trigger --query Configuration.FunctionArn --output text)

Write-Host "4. Updating API Gateway..."
$ApiId = (aws apigatewayv2 get-apis --query "Items[?Name=='dq-custom-configs-api'].ApiId" --output text)

try { aws lambda add-permission --function-name lambda-orchestrator-trigger --statement-id apigw-trigger --action "lambda:InvokeFunction" --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${Region}:${AccountId}:${ApiId}/*" | Out-Null } catch {}

$IntOrchestrator = aws apigatewayv2 create-integration --api-id $ApiId --integration-type AWS_PROXY --integration-uri $OrchestratorArn --payload-format-version 2.0 | ConvertFrom-Json

aws apigatewayv2 create-route --api-id $ApiId --route-key "POST /orchestrator" --target "integrations/$($IntOrchestrator.IntegrationId)" | Out-Null

$ApiUrl = "https://${ApiId}.execute-api.${Region}.amazonaws.com"
Write-Host "Orchestrator URL: $ApiUrl/orchestrator"

Write-Host "5. Updating frontend/.env.local..."
$EnvPath = "frontend/.env.local"
$EnvContent = Get-Content $EnvPath
$EnvContent = $EnvContent -replace "NEXT_PUBLIC_TRIGGER_API_URL=.*", "NEXT_PUBLIC_TRIGGER_API_URL=$ApiUrl/orchestrator"
Set-Content -Path $EnvPath -Value $EnvContent

Write-Host "Deployment Complete!"
