# Autonomous Data Quality (DQ) Management Platform

An enterprise-grade, AI-augmented Data Quality Automation Platform that autonomously profiles relational databases, ingests unstructured domain business constraints, generates statistical & LLM-driven quality rules, and monitors databases for anomalies in real time.

---

## Architecture Overview

The system is built on a **decoupled 3-tier microservice architecture**, isolating the client presentation layer from cloud infrastructure and database engines via a dedicated middle-tier API Gateway.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TIER 1: CLIENT FRONTEND                         │
│   Next.js 16 (App Router) + React + Tailwind CSS (Port 3000)           │
│   • 0ms Optimistic UI updates      • Pure HTTP via middlewareApi       │
│   • Responsive Analytics UI        • Zero direct database drivers      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (HTTP REST / X-Tenant-ID)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   TIER 2: STANDALONE MIDDLEWARE                        │
│   FastAPI Middle-Tier Ingress Gateway (Port 8000)                      │
│   • Multi-Tenant & JWT Auth        • Worker ThreadPool Dispatch        │
│   • Connection Pool (autocommit)   • AWS Boto3 SDK Cloud Adapter       │
│   • Latency Timing Headers         • CORS Preflight Bypass             │
└───────┬───────────────────────────┬────────────────────────────┬───────┘
        │                           │                            │
        ▼                           ▼                            ▼
┌──────────────────┐      ┌──────────────────┐        ┌──────────────────┐
│  RDS PostgreSQL  │      │  AWS Cloud Infra │        │ Bedrock / Agent  │
│  (Port 5432)     │      │  • S3 Buckets    │        │  • AgentCore     │
│  • dq_profiles   │      │  • lambda-prof   │        │  • Groq Cloud    │
│  • dq_rules      │      │  • lambda-check  │        │  • LLM Inference │
│  • dq_violations │      │  • lambda-config │        │  • BackgroundTask│
└──────────────────┘      └──────────────────┘        └──────────────────┘
```

> [!NOTE]
> For in-depth technical specifications, sequence diagrams, and database entity relationships, refer to the [System Architecture Guide](file:///c:/Users/Adithya/Desktop/dq-system/docs/SYSTEM_ARCHITECTURE.md).

---

## Component Deep Dive

### 1. Frontend Client ([`frontend/`](file:///c:/Users/Adithya/Desktop/dq-system/frontend/))
- **Framework**: Next.js 16 (Turbopack) with React 19 and Tailwind CSS.
- **Port**: `3000`
- **Key Modules**:
  - [`frontend/src/app/page.js`](file:///c:/Users/Adithya/Desktop/dq-system/frontend/src/app/page.js): **Data Health Dashboard** displaying global health scores, table anomaly distributions, and direct controls to run compliance checks.
  - [`frontend/src/app/rules/page.js`](file:///c:/Users/Adithya/Desktop/dq-system/frontend/src/app/rules/page.js): **DQ Rules Review Console** supporting rule filtering, single/batch approval/rejection with **0ms optimistic updates**, parameterization modal, generation history, and trigger buttons.
  - [`frontend/src/app/configs/page.js`](file:///c:/Users/Adithya/Desktop/dq-system/frontend/src/app/configs/page.js): **Business Rules Manager** for uploading unstructured documentation (PDF/TXT) or entering manual business rules.
  - [`frontend/src/app/database/page.js`](file:///c:/Users/Adithya/Desktop/dq-system/frontend/src/app/database/page.js): **Database Schema Explorer** inspecting table profiles, column statistical distributions, and inserting test payloads.
  - [`frontend/src/lib/middleware-client.js`](file:///c:/Users/Adithya/Desktop/dq-system/frontend/src/lib/middleware-client.js): Unified API client handling all requests to the Middleware.

### 2. Standalone Middleware ([`middleware/`](file:///c:/Users/Adithya/Desktop/dq-system/middleware/))
- **Framework**: FastAPI + Uvicorn + Starlette.
- **Port**: `8000`
- **Key Capabilities**:
  - **High-Performance Connection Pool ([`connection.py`](file:///c:/Users/Adithya/Desktop/dq-system/middleware/app/db/connection.py))**: Maintains warm `pg8000` sockets with `autocommit=True` and background pre-warming, dropping query latencies from **~2.5s down to ~0.3s**.
  - **Thread-Pool Offloading**: Endpoints are executed in worker threads, preventing synchronous database or AWS socket I/O from freezing the FastAPI ASGI event loop.
  - **Multi-Tenant Gateway ([`middleware.py`](file:///c:/Users/Adithya/Desktop/dq-system/middleware/app/core/middleware.py))**: Extracts tenant IDs, times request durations, attaches telemetry headers (`X-Process-Time`, `X-Tenant-ID`), and bypasses CORS `OPTIONS` preflights.
  - **AWS SDK Integration ([`aws_service.py`](file:///c:/Users/Adithya/Desktop/dq-system/middleware/app/services/aws_service.py))**: Generates S3 presigned PUT URLs and invokes Lambda functions asynchronously.

### 3. Database Layer (PostgreSQL on Amazon RDS)
- **Engine**: Amazon RDS (PostgreSQL 15+)
- **Core Tables**:
  - `dq_profiles`: Statistical profiling data for every monitored table and column (nulls, distinct values, min/max bounds, averages, string lengths, sample distributions).
  - `dq_custom_configs`: Active domain constraints parsed from uploaded PDFs or entered manually.
  - `dq_rules_proposed`: Candidate rules generated by AI agents awaiting human review.
  - `dq_rules`: Approved production rules evaluated by the anomaly detection engine.
  - `dq_violations`: Real-time anomaly logs capturing rule infractions and offending values.
  - **Sample Target**: Pagila relational database (`actor`, `film`, `customer`, `payment`, `rental`, `inventory`).

### 4. Cloud Serverless Suite (AWS Lambda)
- **`lambda-profiler`** ([`lambda-profiler/`](file:///c:/Users/Adithya/Desktop/dq-system/lambda-profiler/)): Scans relational tables in PostgreSQL, computes column statistics, and updates `dq_profiles`.
- **`lambda-checker`** ([`lambda-checker/`](file:///c:/Users/Adithya/Desktop/dq-system/lambda-checker/)): Audits active database records against approved `dq_rules` and writes anomalies to `dq_violations`.
- **`lambda-config-processor`** ([`lambda-config-processor/`](file:///c:/Users/Adithya/Desktop/dq-system/lambda-config-processor/)): Triggered automatically by S3 `s3:ObjectCreated:*` events. Extracts text from PDF documents using `PyPDF2` and persists raw text to `dq_custom_configs`.
- **`lambda-orchestrator-trigger`** ([`lambda-orchestrator-trigger/`](file:///c:/Users/Adithya/Desktop/dq-system/lambda-orchestrator-trigger/)): Secure bridge that assumes an IAM role to trigger the AWS Bedrock AgentCore runtime.

### 5. AI Agentic Rule Generation Engine
- **AWS Bedrock AgentCore**: Hosts the `dqagent` containerized runtime (`dqagent/Dockerfile`).
- **Anti-Timeout Pattern**: Returns HTTP 200 immediately to AWS Bedrock to satisfy the 29-second gateway timeout, delegating the heavy rule generation loop to a FastAPI `BackgroundTask`.
- **Groq LLM**: Queries fast inference models (such as `qwen/qwen3.8-27b`) with profile batches and custom business constraints to generate structured rule schemas.

---

## Core System Workflows

### 1. Statistical Profiling
```
User clicks "Run Profiler"
  │
  ▼
Next.js UI ──POST /api/v1/triggers/profiler──► Middleware ──boto3 (async)──► lambda-profiler
                                                                                   │
                                  Amazon RDS (dq_profiles) ◄──Writes statistics────┘
```

### 2. Business Constraint Ingestion (PDF / Text)
```
User uploads requirements PDF (e.g. shipping_rules.pdf)
  │
  ▼
Next.js UI ──POST /api/v1/configs/presigned-url──► Middleware (Returns signed S3 PUT URL)
  │
  ▼ (Direct binary upload)
Amazon S3 Bucket ──s3:ObjectCreated:* Event──► lambda-config-processor
                                                        │ (PyPDF2 Text Extraction)
                                                        ▼
                                             Amazon RDS (dq_custom_configs)
```

### 3. Rule Review & Approval (Zero UI Latency)
```
User clicks "Approve All"
  │
  ├─► [Instant 0ms Optimistic UI Update: items vanish immediately from table]
  │
  ▼ (Background REST call)
Next.js UI ──POST /api/v1/rules/approve-all──► Middleware (DatabaseConnectionPool)
                                                        │
                                                        ▼ (Single atomic SQL query)
                                             Amazon RDS (INSERT INTO dq_rules SELECT...)
```

---

## Quick Start & Running Locally

### Option A: Multi-Container Setup (Docker Compose)
Run both the Next.js Frontend and FastAPI Middleware as isolated containers:

```bash
docker-compose up --build
```
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Middleware**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option B: Native Development Setup

#### 1. Start the Middleware
```bash
cd middleware
pip install -r requirements.txt
python run.py
```

#### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Key Performance Optimizations

1. **Persistent Connection Pooling**:
   Eliminates TCP and TLS handshakes to AWS `us-east-1` on every request. Reusing warm sockets with `autocommit=True` reduced query latency from **2.52s to 0.34s** (**6.5x faster**).
2. **FastAPI Multi-Threaded Dispatch**:
   All database endpoints are standard synchronous functions (`def`), allowing Starlette to dispatch them onto worker threads. Concurrent polling and button clicks never freeze the event loop.
3. **0ms Optimistic UI Updates**:
   Rule approve/reject actions filter the local React state instantly. Database set operations (`WHERE id IN (...)`) execute asynchronously in the background.
4. **Adaptive Background Polling**:
   Background syncing operates on a relaxed 15-second timer and automatically sleeps when the browser tab is hidden (`document.hidden`). Generation history and custom configuration panels load on-demand when activated.

---

## Environment Variables Reference

### Middleware ([`middleware/.env.example`](file:///c:/Users/Adithya/Desktop/dq-system/middleware/.env.example))
```ini
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=development

DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-db-password

AWS_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name
LAMBDA_PROFILER_NAME=lambda-profiler
LAMBDA_CHECKER_NAME=lambda-checker
LAMBDA_AGENT_TRIGGER_NAME=lambda-orchestrator-trigger

REQUIRE_AUTH=false
DEFAULT_TENANT_ID=default
```

### Frontend ([`frontend/.env.local`](file:///c:/Users/Adithya/Desktop/dq-system/frontend/.env.local))
```ini
NEXT_PUBLIC_MIDDLEWARE_URL=http://localhost:8000
```
