# Standalone Middleware Service

## 1. Overview
This is a dedicated, decoupled **Middle-Tier API Gateway and Orchestration Service** for the Data Quality (DQ) Automation Platform. It sits between client applications (e.g., the Next.js frontend container) and the AWS Cloud backend (Amazon RDS PostgreSQL, AWS Bedrock AgentCore, AWS Lambda, and Amazon S3).

```
[ Next.js Frontend Container ] 
            │ (HTTP / REST / JWT)
            ▼
[ STANDALONE MIDDLEWARE SERVICE (Port 8000) ]
     ├── Auth & Multi-Tenant Interceptor
     ├── Database Connection Pool (RDS PostgreSQL)
     └── AWS SDK Orchestrator (boto3)
            │
            ├───────────────┬────────────────┬──────────────┐
            ▼               ▼                ▼              ▼
     [ RDS PostgreSQL ]  [ Amazon S3 ]  [ Bedrock Agent ] [ Lambdas ]
```

---

## 2. API Endpoints Reference

All application endpoints are served under `/api/v1`:

### Health & Discovery
* `GET /health`: Health status check.
* `GET /docs`: Interactive Swagger OpenAPI UI.
* `GET /redoc`: Alternative ReDoc documentation.

### Dashboard Analytics
* `GET /api/v1/dashboard/metrics`: Summary stats (`activeRules`, `totalAnomalies`, `tablesMonitored`, `healthScore`).
* `GET /api/v1/dashboard/tables`: Detailed table-by-table health and anomaly breakdown.

### Rule Management
* `GET /api/v1/rules`: List all currently proposed DQ rules.
* `POST /api/v1/rules/approve`: Approve a single proposed rule by `{"rule_id": 123}`.
* `POST /api/v1/rules/approve-all`: Batch approve rules by `{"rule_ids": [1, 2, 3]}`.
* `POST /api/v1/rules/reject`: Reject a single rule by `{"rule_id": 123}`.
* `POST /api/v1/rules/reject-all`: Batch reject rules by `{"rule_ids": [1, 2, 3]}`.
* `POST /api/v1/rules/update`: Update rule config JSON by `{"rule_id": 123, "rule_config": {...}}`.
* `GET /api/v1/rules/summary`: Count of approved rules.
* `GET /api/v1/rules/history`: Historical rule generation timeline grouped by batch.

### Custom Configurations & S3 Uploads
* `GET /api/v1/configs`: List active custom business rules and constraints.
* `POST /api/v1/configs`: Save raw business rules text.
* `DELETE /api/v1/configs/{config_id}`: Delete an active custom config.
* `POST /api/v1/configs/presigned-url`: Generate a secure S3 presigned PUT URL for uploading PDF/TXT rule docs.

### Database Operations
* `GET /api/v1/database/profiles`: Grouped statistical profiles of tables and columns.
* `POST /api/v1/database/insert`: Insert test data with strict identifier validation to test rule triggers.

### Cloud Orchestration Triggers
* `POST /api/v1/triggers/profiler`: Triggers AWS Lambda Profiler via Boto3 asynchronously.
* `POST /api/v1/triggers/checker`: Triggers AWS Lambda Checker via Boto3 asynchronously.
* `POST /api/v1/triggers/agent`: Triggers Bedrock AgentCore runtime to generate rules.

---

## 3. Running Locally

### Prerequisites
* Python 3.11+
* Dependencies:
  ```bash
  pip install -r requirements.txt
  ```

### Start the Service
```bash
python run.py
```
The server will start on `http://localhost:8000`. You can test every endpoint directly at `http://localhost:8000/docs`.

---

## 4. Running with Docker

### Build the Container
```bash
docker build -t dq-standalone-middleware .
```

### Run the Container
```bash
docker run -d -p 8000:8000 --env-file .env.example --name dq-middleware dq-standalone-middleware
```
