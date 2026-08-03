# Data Quality (DQ) Automation System

## Overview
This repository contains a full-stack, AI-augmented Data Quality Automation Pipeline. The system is designed to automatically profile database tables, generate intelligent data quality rules using Machine Learning and LLM Agents, and monitor databases for rule violations.

## Architecture Components

1. **Frontend (`frontend/`)**: A Next.js/React web application that visualizes the data quality metrics, displays proposed rules, and highlights data violations.
2. **Lambda Profiler (`lambda-profiler/`)**: An AWS Lambda function that scans your PostgreSQL database to generate statistical profiles (null rates, distinct counts, max/min values, etc.) and saves them to the `dq_profiles` table.
3. **Lambda Checker (`lambda-checker/`)**: An AWS Lambda function that validates actual database data against the accepted rules to find anomalies.
4. **Machine Learning Pipelines (`ml-randomforest/`, `ml-xgboost/`)**: ML models that detect complex anomalies based on historical profiling data.
5. **DQ Agent (`dqagent/`)**: A containerized LLM Agent service (powered by Groq / Llama 3) that reads database profiles and automatically generates natural-language driven rules, saving them as proposals to the `dq_rules_proposed` table.

---

## Deploying the DQ Agent to AWS Bedrock AgentCore

The `dqagent` is built to run on the AWS AgentCore runtime. Because AgentCore has strict timeout limits, the agent uses a lightweight FastAPI server that instantly responds with an HTTP 200 Success status and offloads the heavy LLM generation to a background thread.

### 1. Build and Push the Docker Image
AgentCore requires a `linux/arm64` container image (for AWS Graviton compatibility). From your machine, use Docker Buildx to cross-compile and push the image to AWS ECR:

```bash
# Navigate to the agent directory
cd dqagent

# Authenticate with your AWS ECR
aws ecr get-login-password --region <YOUR-REGION> | docker login --username AWS --password-stdin <YOUR-ACCOUNT-ID>.dkr.ecr.<YOUR-REGION>.amazonaws.com

# Build the ARM64 image (bypass Windows/WSL NVIDIA bugs by using a clean builder if necessary)
docker buildx build --platform linux/arm64 -t dq-agent-runtime . --load

# Tag and Push to ECR
docker tag dq-agent-runtime:latest <YOUR-ACCOUNT-ID>.dkr.ecr.<YOUR-REGION>.amazonaws.com/dq-agent-runtime:latest
docker push <YOUR-ACCOUNT-ID>.dkr.ecr.<YOUR-REGION>.amazonaws.com/dq-agent-runtime:latest
```

### 2. Configure AWS AgentCore Runtime
Once the image is in ECR, navigate to the **AWS Bedrock AgentCore** console and create a new runtime with the following settings:
- **Architecture**: `ARM64`
- **Container Image URI**: `<YOUR-ACCOUNT-ID>.dkr.ecr.<YOUR-REGION>.amazonaws.com/dq-agent-runtime:latest`
- **Protocol**: `HTTP`
- **Port Mapping**: `8080` (This is exposed by the FastAPI `uvicorn` server)

### 3. Environment Variables
Add the following key-value pairs in the AgentCore runtime configuration so the agent can authenticate with Groq and your PostgreSQL database:
- `GROQ_API_KEY`: Your Groq API key (e.g., `gsk_...`)
- `DB_HOST`: Your RDS PostgreSQL endpoint
- `DB_PORT`: `5432`
- `DB_NAME`: Your database name
- `DB_USER`: Your database username
- `DB_PASSWORD`: Your database password

### 4. The Trigger Architecture (Frontend to AgentCore)
To allow the Next.js frontend to securely trigger the AgentCore runtime without exposing AWS credentials, we use a lightweight Lambda function (`lambda-agent-trigger/lambda_function.py`) as a secure bridge.

1. **Frontend:** Hits an AWS API Gateway endpoint (`NEXT_PUBLIC_TRIGGER_API_URL` in `.env.local`).
2. **API Gateway:** Routes the request to the `dq-agent-trigger` Lambda function.
3. **Lambda Trigger:** Uses the `boto3` SDK to assume its IAM role and invoke the Bedrock AgentCore runtime securely, bypassing complex Signature V4 authentication requirements.
4. **AgentCore:** Wakes up the `dqagent` runtime container via the `POST /invocations` route.

*Note: The agent does not require a specific JSON payload or prompt to be passed in the body. Upon receiving a POST request, it automatically retrieves profiles from the DB and generates rules.*
