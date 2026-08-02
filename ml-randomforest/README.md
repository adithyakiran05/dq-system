# Data Quality ML Router (AWS Lambda)

This repository contains the Machine Learning routing architecture for a smart Data Quality automation system. It acts as an intelligent proxy that evaluates incoming database profiles and predicts high-confidence Data Quality rules using a trained `scikit-learn` Random Forest Classifier.

If the model predicts a rule with > 85% confidence (such as detecting `not_null` constraints, `unique` identifiers, or `fixed_length` formats), it instantly generates the rule. If the confidence is lower (due to messy or unstructured data), it dynamically falls back to an AWS Bedrock GenAI Agent for deeper reasoning.

## Architecture

The system is designed to run natively in AWS using a robust Docker container to bypass the strict size limitations of Python ML libraries (`numpy`, `pandas`, `scikit-learn`).

*   **Trigger Lambda (`trigger_lambda.py`):** Intercepts API requests from the frontend, downloads the latest ML model weights (`.pkl`) from AWS S3 directly into memory, and performs inference on the incoming profiles. Routes unhandled profiles to AWS Bedrock.
*   **Trainer Lambda (`trainer_lambda.py`):** Connects natively to the RDS PostgreSQL database to query newly approved rules, retrains the Random Forest model on the live data, and uploads the updated model back to S3. This enables continuous learning.
*   **ML Model (`ml_model.py`):** The core `scikit-learn` pipeline encompassing data preprocessing, encoding, and the `RandomForestClassifier`.
*   **Docker Container (`Dockerfile`):** An Amazon Linux 2023 environment (`public.ecr.aws/lambda/python:3.12`) that compiles the C-bindings for the ML libraries and serves the Lambdas.

## Deployment

To deploy this architecture to AWS ECR and Lambda:

1. **Build the Docker Image:**
   ```bash
   docker build -t dq-agent-lambdas . --provenance=false
   ```
2. **Push to ECR:**
   ```bash
   aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <your-account-id>.dkr.ecr.<your-region>.amazonaws.com
   docker tag dq-agent-lambdas:latest <your-account-id>.dkr.ecr.<your-region>.amazonaws.com/dq-agent-lambdas:latest
   docker push <your-account-id>.dkr.ecr.<your-region>.amazonaws.com/dq-agent-lambdas:latest
   ```
3. **Update AWS Lambda:**
   ```bash
   aws lambda update-function-code --function-name dq-trigger-function --image-uri <your-account-id>.dkr.ecr.<your-region>.amazonaws.com/dq-agent-lambdas:latest
   ```

## Local Training

You can bootstrap the model using synthetic data before deploying to AWS. The `train.py` script generates 12,000 synthetic database profiles simulating highly structured and highly unstructured data to train the initial router boundaries.

```bash
python train.py
```
*(Note: Be sure your local `numpy` version matches the AWS environment (`1.26.4`) to prevent Pickling incompatibility errors. It is recommended to execute `train.py` directly inside the Docker container.)*
