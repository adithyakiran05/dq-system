# DQ Agent Architecture & Implementation Guide

This document outlines the architecture, flow, and deployment process for the Data Quality (DQ) Agent. This serves as a reference for future maintenance or when adding new features.

## 1. System Architecture

The DQ Agent utilizes a serverless event-driven architecture heavily reliant on AWS services and external LLMs.

**Core Components:**
- **Frontend / Client**: Initiates the request to trigger rule generation.
- **AWS API Gateway**: Exposes the trigger endpoint publicly.
- **AWS Lambda (`lambda-agent-trigger`)**: Acts as a bridge. It receives the HTTP request from API Gateway and synchronously invokes the AWS Bedrock Agent Runtime using `boto3`.
- **AWS Bedrock Custom Agent**: The core orchestration layer. It runs a custom Docker container (hosted on AWS ECR).
- **Agent Container (`dqagent/agent.py`)**: A FastAPI application running on `uvicorn`. This is where the core logic lives.
- **Groq API**: The LLM provider used for generating rules. We currently use `qwen/qwen3.8-27b` (as it is highly capable and active on Groq).
- **Amazon RDS (PostgreSQL)**: Stores the generated rules and profile data.

---

## 2. Execution Flow & The "Chunk-by-Chunk" Pattern

AWS Bedrock Custom Agent containers have aggressive CPU-throttling/freezing behavior. Once the container sends an HTTP response back to Lambda, AWS freezes the container's CPU. To bypass AWS API Gateway timeouts (29s) and Bedrock constraints, we use the following asynchronous pattern:

1. **Trigger**: Lambda invokes the Bedrock agent `/invoke` endpoint (which maps to our FastAPI `/generate-rules` endpoint).
2. **Immediate Acknowledgment**: The FastAPI app immediately schedules the heavy lifting (fetching data, calling Groq, saving to DB) as a **FastAPI `BackgroundTask`**.
3. **Return Early**: The API immediately returns a HTTP `200 OK` response: `{"status": "success", "message": "Successfully started processing..."}`. This prevents Lambda and API Gateway from timing out.
4. **Background Processing**: The container continues running the background task. 
   - It fetches the list of profiles from RDS.
   - It splits the profiles into small batches (e.g., chunks of 6).
   - It iterates through each batch, calling the Groq API (`client.chat.completions.create`) to generate rules.
   - It parses the LLM JSON output and inserts the rules back into RDS.

---

## 3. How to Deploy Updates

When you make changes to the agent logic in `agent.py` (e.g., changing the LLM model, updating prompts, or changing chunk sizes), you must rebuild and redeploy the Docker container.

### Step 1: Build and Push to ECR
Run the deployment script from the `dqagent` directory:
```powershell
cd dqagent
.\deploy_agent.ps1
```
This script will:
- Authenticate Docker with your AWS ECR registry.
- Build the Docker image based on the `Dockerfile`.
- Tag it as `latest`.
- Push it to your ECR repository (`<your-account-id>.dkr.ecr.<region>.amazonaws.com/dq-agent-runtime`).

### Step 2: Update AWS Bedrock Runtime
AWS Bedrock **caches** container images. Pushing a new image to ECR with the `latest` tag does **not** automatically update the running agent.

1. Go to the **AWS ECR Console**. Find the newly pushed image and copy its exact **Image URI with the SHA digest** (e.g., `.../dq-agent-runtime@sha256:12345...`).
2. Go to the **AWS Bedrock Console**.
3. Navigate to your Custom Agent (`<your-agent-id>`).
4. Edit the **Agent Runtime** settings.
5. Replace the Image URI with the newly copied URI containing the SHA digest.
6. Click **Update Runtime Version**.
7. *Wait 3-5 minutes* for the rolling deployment to spin up the new container and spin down the old one.

### Step 3: Verify
Trigger the generation process from your frontend and monitor the Bedrock Agent logs in AWS CloudWatch (`/aws/bedrock-agentcore/runtimes/...`) to ensure the new container is receiving traffic and successfully processing chunks.

---

## 4. Common Troubleshooting

- **Model Decommissioned / 404 Errors**: Groq frequently rotates and decommissions models (e.g., `llama-3.1-8b`, `qwen-2.5-32b`, `llama-3.3-70b-versatile`). If you see a `404 model_not_found` or `400 model_decommissioned` error in the CloudWatch logs, you need to query the Groq API (`https://api.groq.com/openai/v1/models`) to find an active model and update `agent.py`.
- **Container Freezing**: If the background task silently stops halfway through without throwing an error, AWS Bedrock might have throttled the CPU. Ensure your LLM calls are fast and continuous. If the gap between CPU usage is too long (e.g., during a long `time.sleep()`), AWS will freeze the container.
