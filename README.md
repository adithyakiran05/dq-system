# Data Quality (DQ) Automation System

## Overview
This repository contains a full-stack, AI-augmented Data Quality Automation Pipeline. The system is designed to automatically profile database tables, generate intelligent data quality rules using Machine Learning and LLM Agents, and monitor databases for rule violations.

## Architecture Components

1. **Frontend (`frontend/`)**: A Next.js/React web application that visualizes the data quality metrics, displays proposed rules, and highlights data violations. It also includes an interface for managing **Custom Configurations**.
2. **Lambda Profiler (`lambda-profiler/`)**: An AWS Lambda function that scans your PostgreSQL database to generate statistical profiles (null rates, distinct counts, max/min values, etc.) and saves them to the `dq_profiles` table.
3. **Lambda Checker (`lambda-checker/`)**: An AWS Lambda function that validates actual database data against the accepted rules to find anomalies.
4. **Lambda Config Processor (`lambda-config-processor/`)**: An AWS Lambda function triggered by S3 uploads. It parses uploaded custom configuration files (like PDF and TXT), extracts the raw text, and stores it in the `dq_custom_configs` table in RDS.
5. **Machine Learning Pipelines (`ml-randomforest/`, `ml-xgboost/`)**: ML models that detect complex anomalies based on historical profiling data.
6. **DQ Agent (`dqagent/`)**: A containerized LLM Agent service (powered by Groq / Llama 3) that reads database profiles, injects any active **Custom Configurations** into its system prompt, and automatically generates natural-language driven rules, saving them as proposals to the `dq_rules_proposed` table.

---

## The Custom Configurations Pipeline

To ensure the AI generates rules that strictly align with domain-specific business constraints (e.g., "All shipping IDs must be 10 characters long"), users can upload custom configurations through the frontend.

1. **Uploads**: The Next.js frontend uses AWS pre-signed URLs to upload PDF or TXT files directly to an S3 bucket (`dq-custom-configs-bucket-1696417599`).
2. **Processing**: S3 triggers the `lambda-config-processor`, running Python 3.12. It extracts the raw text from the files using PyPDF2 or plain text decoders and inserts it into the `dq_custom_configs` RDS table via `pg8000`.
3. **Agent Integration**: When the `dqagent` runs, it dynamically fetches all active configurations from the `dq_custom_configs` table, concatenates them, and injects them directly into the agent's system prompt to enforce strict business logic during generation.
4. **Management UI**: Users can view and delete active configurations directly from the frontend via Next.js API routes (`/api/configs/list` and `/api/configs/delete`), reusing the same RDS connection pool as the rule management system.

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

*Note: The agent processes profiles in optimized chunk sizes (e.g., batches of 6) and includes an exponential backoff retry mechanism (15-second pauses) to avoid strict Tokens-Per-Minute rate limits on the Groq LLM API caused by the massive custom configurations payloads.*
