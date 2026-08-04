$ErrorActionPreference = "Stop"

$AccountId = (aws sts get-caller-identity --query Account --output text)
$Region = "us-east-1"
$RepoUri = "$AccountId.dkr.ecr.$Region.amazonaws.com/dq-agent-runtime"

Write-Host "Logging into ECR..."
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $RepoUri

Write-Host "Building Docker image..."
docker buildx build --platform linux/arm64 -t dq-agent-runtime . --load

Write-Host "Tagging and pushing image..."
docker tag dq-agent-runtime:latest "$RepoUri`:latest"
docker push "$RepoUri`:latest"

Write-Host "Done!"
