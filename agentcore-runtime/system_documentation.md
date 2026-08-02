# Data Quality (DQ) System Architecture & Documentation

This document outlines the system architecture, technology stack, and core logic of the Data Quality Agent system, including the AI model integration and serverless backend components.

## 1. System Architecture Overview

The Data Quality (DQ) system is an automated, AI-driven architecture designed to profile database tables, propose data quality rules using a Large Language Model (LLM), and enforce those rules continuously. It operates on an AWS serverless architecture.

### Core Components

1.  **Profiler Lambda**: Scans the database schema, computes statistical profiles for each column based on its data type, and saves the metrics.
2.  **Trigger Lambda**: An AWS Lambda function that orchestrates the AI workflow by invoking the AWS Bedrock AgentCore runtime to generate rules.
3.  **DQ Agent (AWS Bedrock Agent)**: An AI agent hosted in the AWS Bedrock AgentCore runtime. It utilizes the Model Context Protocol (MCP) to securely fetch data profiles and save proposed DQ rules back to the database.
4.  **Frontend (Next.js)**: A web application allowing users to view data profiles, and approve or reject the AI-proposed data quality rules.
5.  **Checker Lambda**: Fetches user-approved Data Quality rules from the database, executes them against the actual data, and logs any violations.

---

## 2. Technology Stack & AI Integration

*   **Cloud / Execution Environment**: AWS Serverless Compute (AWS Lambda, Bedrock AgentCore).
*   **Database**: PostgreSQL
*   **Backend / Lambdas Language**: Python 3.x
*   **Database Driver (Python)**: `pg8000` (A pure-Python PostgreSQL driver, chosen for ease of deployment in Lambda).
*   **AI Agent Runtime**: AWS Bedrock AgentCore.
*   **Agent Tooling**: Model Context Protocol (MCP) via `fastmcp` (Streamable HTTP server).
*   **Frontend Framework**: Next.js (App Router API routes: `/api/rules`, `/api/rules/approve`, `/api/rules/reject`).

---

## 3. Component Logic & Details

### 3.1 Trigger Lambda & Agent Orchestration
**Purpose**: Kick off the AI rule generation process.

**Logic Flow**:
1.  **Invocation**: This Lambda is typically triggered on a schedule or via an API call.
2.  **Bedrock Integration**: It initializes the `boto3` client for `bedrock-agentcore`.
3.  **Agent Execution**: It invokes a specific Bedrock Agent runtime ARN (`arn:aws:bedrock-agentcore:...`) with a payload indicating the action: `{"action": "generate_rules"}`.
4.  **Response**: The Lambda waits for the Bedrock agent to complete its reasoning and tool execution loop, parses the response, and returns the status.

**Sample I/O**:
*   **Input**: Empty Lambda event (or API Gateway event).
*   **Payload sent to Agent**: `{"action": "generate_rules"}`
*   **Output Payload**:
    ```json
    {
        "statusCode": 200,
        "body": "{\"status\": \"success\", \"message\": \"Agent triggered successfully\", \"data\": {...}}"
    }
    ```
### 3.2 DQ Agent (Bedrock + MCP)
**Purpose**: Act as the "brain" of the system to analyze data profiles and deduce logical data quality rules.

**Logic Flow**:
1.  **Model/Runtime**: The agent runs within the AWS Bedrock environment.
2.  **Tool Access (MCP Server)**: The agent accesses the database through an MCP server (`mcp_server.py`) running `FastMCP`. This provides a secure, well-defined boundary.
3.  **Available Capabilities**: The agent uses the following MCP tools to do its job:
    *   `get_profiles()` / `get_profile()`: Fetches the statistical shape of the data (null rates, distinct rates, min/max values, sample values).
    *   `get_existing_rules()`: Checks what rules already exist to avoid duplicates.
    *   `save_rule()` / `save_rules_bulk()`: Once the LLM decides on appropriate rules (e.g., "age should be > 0", "email must match regex"), it calls these tools to insert the rules into the `dq_rules_proposed` table.
4.  **Metadata**: Proposed rules are saved with an initial `severity`, a calculated `confidence` score from the LLM, and tagged with `generated_by = 'bedrock-agent'`.

**Sample Tool I/O (save_rule)**:
*   **Input Arguments**:
    ```json
    {
        "table_name": "users",
        "column_name": "age",
        "rule_type": "min_value",
        "severity": "high",
        "confidence": 0.95,
        "rule_config": "{\"min_value\": 0}"
    }
    ```
*   **Output**: `"saved"`
### 3.3 Profiler Lambda
**Purpose**: Automatically assess the shape and statistical characteristics of data in the database.

**Logic Flow**:
1.  **Schema Introspection**: Queries `information_schema.columns` to get all tables and columns, excluding metadata tables.
2.  **Data Profiling**: Dynamically constructs SQL queries based on column data type (Numeric, Temporal, String) to compute min, max, average, standard deviation, length bounds, null counts, and distinct counts.
3.  **Sampling & Storage**: Extracts random sample records and stores the aggregated metrics into the `dq_profiles` table, which the AI agent will later read.

**Sample I/O**:
*   **Input**: AWS Lambda Event (typically empty or triggered via scheduled EventBridge rule).
*   **Output Payload**:
    ```json
    {
        "statusCode": 200,
        "success": 24,
        "failed": 0
    }
    ```
### 3.4 Checker Lambda
**Purpose**: Execute approved data quality rules against the data to identify anomalies and invalid records.

**Logic Flow**:
1.  **Rule Ingestion**: Fetches all active rules from the `dq_rules` table.
2.  **Dynamic SQL Generation**: Iterates through the rules and dynamically constructs a `WHERE` clause designed to find *violations*. Supported rule types include `not_null`, `unique`, `min_value`/`max_value`, `length`, `accepted_values`, `email_format`, and `regex_match`.
3.  **Execution & Violation Logging**: Executes the queries with a `LIMIT 100`. For every violating row, it inserts a record into the `dq_violations` table containing the offending value and the query context.

**Sample I/O**:
*   **Input**: AWS Lambda Event (typically empty or triggered via scheduled EventBridge rule).
*   **Output Payload**:
    ```json
    {
        "statusCode": 200,
        "body": "{\"message\": \"Validation complete\", \"violations_found\": 12}"
    }
    ```
### 3.5 Frontend (Next.js API)
**Purpose**: Human-in-the-loop review interface.

**Logic Flow**:
Because LLMs can hallucinate or propose overly strict rules, the frontend acts as a governance gate:
*   `/api/rules`: Fetches rules from `dq_rules_proposed` (created by the Bedrock Agent).
*   `/api/rules/approve`: Moves a proposed rule from `dq_rules_proposed` into the active `dq_rules` table, where the Checker Lambda will begin enforcing it.
*   `/api/rules/reject`: Discards a proposed rule.
