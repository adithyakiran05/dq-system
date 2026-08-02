/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DqProfile, DqRule, DqViolation } from './types';

// Raw table structures for simulation visual
export const MOCK_RAW_TABLES = {
  users: {
    columns: [
      { name: 'id', type: 'integer', desc: 'Primary key' },
      { name: 'name', type: 'varchar(255)', desc: 'User full name' },
      { name: 'email', type: 'varchar(255)', desc: 'User contact email' },
      { name: 'age', type: 'integer', desc: 'User age in years' },
      { name: 'created_at', type: 'timestamp', desc: 'Record insertion time' }
    ],
    rows: [
      { id: 1, name: 'Alice', email: 'alice@example.com', age: 28, created_at: '2026-07-01 10:00:00' },
      { id: 2, name: 'Bob', email: 'bob_at_example.com', age: -5, created_at: '2026-07-02 11:30:00' }, // Invalid email, negative age
      { id: 3, name: 'Charlie', email: null, age: 34, created_at: '2026-07-03 14:15:00' }, // Null email
      { id: 4, name: 'David', email: 'david@example.com', age: 150, created_at: '2026-07-04 09:00:00' }, // Age too high
      { id: 5, name: 'Alice', email: 'alice@example.com', age: 28, created_at: '2026-07-01 10:00:00' } // Duplicate rows/ids
    ]
  },
  orders: {
    columns: [
      { name: 'id', type: 'integer', desc: 'Primary key' },
      { name: 'user_id', type: 'integer', desc: 'Foreign key referencing users.id' },
      { name: 'amount', type: 'numeric(10,2)', desc: 'Total transaction value' },
      { name: 'status', type: 'varchar(50)', desc: 'Current fulfillment status' },
      { name: 'updated_at', type: 'timestamp', desc: 'Record update time' }
    ],
    rows: [
      { id: 101, user_id: 1, amount: 99.99, status: 'completed', updated_at: '2026-07-10 12:00:00' },
      { id: 102, user_id: 2, amount: -20.00, status: 'pending', updated_at: '2026-07-11 13:00:00' }, // Negative amount
      { id: 103, user_id: 999, amount: 45.50, status: 'invalid_status', updated_at: '2026-07-12 15:30:00' } // Bad status, orphaned user_id
    ]
  }
};

// Initial profiles that the Profiler Lambda generates
export const MOCK_PROFILES: DqProfile[] = [
  {
    table_name: 'users',
    column_name: 'id',
    data_type: 'integer',
    total_rows: 5,
    null_rate: 0.0,
    distinct_rate: 0.8, // 4 unique IDs out of 5 rows due to duplicate row 5
    min_value: 1,
    max_value: 5,
    avg_value: 2.6,
    stddev_value: 1.5,
    min_length: null,
    max_length: null,
    sample_values: [1, 2, 3, 4, 5]
  },
  {
    table_name: 'users',
    column_name: 'email',
    data_type: 'character varying',
    total_rows: 5,
    null_rate: 0.20, // 1 null row out of 5 (20%)
    distinct_rate: 1.0, // all non-null values are distinct
    min_value: 'alice@example.com',
    max_value: 'david@example.com',
    avg_value: null,
    stddev_value: null,
    min_length: 17,
    max_length: 18,
    sample_values: ['alice@example.com', 'bob_at_example.com', 'david@example.com']
  },
  {
    table_name: 'users',
    column_name: 'age',
    data_type: 'integer',
    total_rows: 5,
    null_rate: 0.0,
    distinct_rate: 0.8, // 4 distinct ages (28 is repeated)
    min_value: -5,
    max_value: 150,
    avg_value: 47.0,
    stddev_value: 59.2,
    min_length: null,
    max_length: null,
    sample_values: [28, -5, 34, 150]
  },
  {
    table_name: 'users',
    column_name: 'name',
    data_type: 'character varying',
    total_rows: 5,
    null_rate: 0.0,
    distinct_rate: 0.8, // Alice is repeated
    min_value: 'Alice',
    max_value: 'David',
    avg_value: null,
    stddev_value: null,
    min_length: 3,
    max_length: 7,
    sample_values: ['Alice', 'Bob', 'Charlie', 'David']
  },
  {
    table_name: 'orders',
    column_name: 'amount',
    data_type: 'numeric',
    total_rows: 3,
    null_rate: 0.0,
    distinct_rate: 1.0,
    min_value: -20.00,
    max_value: 99.99,
    avg_value: 41.83,
    stddev_value: 60.1,
    min_length: null,
    max_length: null,
    sample_values: [99.99, -20.00, 45.50]
  },
  {
    table_name: 'orders',
    column_name: 'status',
    data_type: 'character varying',
    total_rows: 3,
    null_rate: 0.0,
    distinct_rate: 1.0,
    min_value: 'completed',
    max_value: 'pending',
    avg_value: null,
    stddev_value: null,
    min_length: 7,
    max_length: 14,
    sample_values: ['completed', 'pending', 'invalid_status']
  }
];

// Proposed rules including active verification filter logs
export const SIMULATED_PROPOSAL_LOGS = [
  {
    rule: { table_name: 'users', column_name: 'id', rule_type: 'unique', rule_config: {}, severity: 'high', confidence: 0.98, dq_type: 'Uniqueness' },
    status: 'rejected_by_rule_engine',
    reason: "Distinct rate (0.8) is less than 0.95. Column has high duplicate rates; unique constraint would trigger immediate false alerts."
  },
  {
    rule: { table_name: 'users', column_name: 'email', rule_type: 'not_null', rule_config: {}, severity: 'high', confidence: 0.95, dq_type: 'Completeness' },
    status: 'rejected_by_rule_engine',
    reason: "Null rate (20.0%) is greater than 5.0%. Cannot enforce 'not_null' until historical data is cleansed."
  },
  {
    rule: { table_name: 'users', column_name: 'email', rule_type: 'email_format', rule_config: {}, severity: 'high', confidence: 0.98, dq_type: 'Validity' },
    status: 'proposed',
    reason: "Valid statistical fit: column name matches 'email' and standard format validation is highly recommended."
  },
  {
    rule: { table_name: 'users', column_name: 'age', rule_type: 'min_value', rule_config: { min_value: 0 }, severity: 'high', confidence: 0.95, dq_type: 'Accuracy' },
    status: 'proposed',
    reason: "Logical domain fit: age columns represent elapsed life years and must never fall below 0."
  },
  {
    rule: { table_name: 'users', column_name: 'age', rule_type: 'max_value', rule_config: { max_value: 125 }, severity: 'medium', confidence: 0.92, dq_type: 'Accuracy' },
    status: 'proposed',
    reason: "Statistical bounding fit: 150 exceeds typical human limits, proposing 125 threshold for anomaly detection."
  },
  {
    rule: { table_name: 'orders', column_name: 'amount', rule_type: 'min_value', rule_config: { min_value: 0.00 }, severity: 'high', confidence: 0.95, dq_type: 'Accuracy' },
    status: 'proposed',
    reason: "Logical domain fit: financial orders cannot have negative amounts."
  },
  {
    rule: { table_name: 'orders', column_name: 'status', rule_type: 'accepted_values', rule_config: { values: ['completed', 'pending', 'failed'] }, severity: 'medium', confidence: 0.88, dq_type: 'Validity' },
    status: 'proposed',
    reason: "Category frequency fit: identified status-like categorical bounds based on high distinct values."
  }
];

// Active proposed rules after filter engine (to be shown in NEXT.JS frontend simulation)
export const MOCK_PROPOSED_RULES: DqRule[] = [
  {
    id: 'prop_01',
    table_name: 'users',
    column_name: 'email',
    rule_type: 'email_format',
    rule_config: {},
    severity: 'high',
    confidence: 0.98,
    generated_by: 'langgraph-agent',
    dq_type: 'Validity',
    status: 'proposed'
  },
  {
    id: 'prop_02',
    table_name: 'users',
    column_name: 'age',
    rule_type: 'min_value',
    rule_config: { min_value: 0 },
    severity: 'high',
    confidence: 0.95,
    generated_by: 'langgraph-agent',
    dq_type: 'Accuracy',
    status: 'proposed'
  },
  {
    id: 'prop_03',
    table_name: 'users',
    column_name: 'age',
    rule_type: 'max_value',
    rule_config: { max_value: 125 },
    severity: 'medium',
    confidence: 0.92,
    generated_by: 'langgraph-agent',
    dq_type: 'Accuracy',
    status: 'proposed'
  },
  {
    id: 'prop_04',
    table_name: 'orders',
    column_name: 'amount',
    rule_type: 'min_value',
    rule_config: { min_value: 0.00 },
    severity: 'high',
    confidence: 0.95,
    generated_by: 'langgraph-agent',
    dq_type: 'Accuracy',
    status: 'proposed'
  },
  {
    id: 'prop_05',
    table_name: 'orders',
    column_name: 'status',
    rule_type: 'accepted_values',
    rule_config: { values: ['completed', 'pending', 'failed'] },
    severity: 'medium',
    confidence: 0.88,
    generated_by: 'langgraph-agent',
    dq_type: 'Validity',
    status: 'proposed'
  }
];

// Sample Violations when checker is executed
export const MOCK_VIOLATIONS: DqViolation[] = [
  {
    id: 'violation_01',
    table_name: 'users',
    column_name: 'email',
    rule_type: 'email_format',
    offending_value: 'bob_at_example.com',
    violation_details: {
      rule_config: {},
      query: "SELECT email FROM users WHERE email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'"
    },
    detected_at: '2026-07-12 21:00:15',
    dq_type: 'Validity'
  },
  {
    id: 'violation_02',
    table_name: 'users',
    column_name: 'age',
    rule_type: 'min_value',
    offending_value: '-5',
    violation_details: {
      rule_config: { min_value: 0 },
      query: "SELECT age FROM users WHERE age < 0"
    },
    detected_at: '2026-07-12 21:00:16',
    dq_type: 'Accuracy'
  },
  {
    id: 'violation_03',
    table_name: 'users',
    column_name: 'age',
    rule_type: 'max_value',
    offending_value: '150',
    violation_details: {
      rule_config: { max_value: 125 },
      query: "SELECT age FROM users WHERE age > 125"
    },
    detected_at: '2026-07-12 21:00:16',
    dq_type: 'Accuracy'
  },
  {
    id: 'violation_04',
    table_name: 'orders',
    column_name: 'amount',
    rule_type: 'min_value',
    offending_value: '-20.00',
    violation_details: {
      rule_config: { min_value: 0.00 },
      query: "SELECT amount FROM orders WHERE amount < 0.00"
    },
    detected_at: '2026-07-12 21:00:17',
    dq_type: 'Accuracy'
  },
  {
    id: 'violation_05',
    table_name: 'orders',
    column_name: 'status',
    rule_type: 'accepted_values',
    offending_value: 'invalid_status',
    violation_details: {
      rule_config: { values: ['completed', 'pending', 'failed'] },
      query: "SELECT status FROM orders WHERE status NOT IN ('completed', 'pending', 'failed')"
    },
    detected_at: '2026-07-12 21:00:18',
    dq_type: 'Validity'
  }
];

// Technical Stack Metadata
export const TECH_STACK = [
  { category: 'Runtime & Orchestration', name: 'AWS Lambda', desc: 'Serverless compute triggers, scaling to zero with zero idle cost. Highly cost-effective.', badge: 'AWS Serverless' },
  { category: 'AI Agent Runtime', name: 'LangGraph Orchestrator', desc: 'Secure agent runtime orchestrating tool execution and system communication.', badge: 'LangGraph' },
  { category: 'Agent Model', name: 'Groq LLaMA-3.3-70B', desc: 'Lightning-fast, highly cost-effective LLM utilized for parsing statistical profiles and generating rules.', badge: 'Groq API' },
  { category: 'AI Connection Protocol', name: 'XGBoost + LangGraph Routing', desc: 'XGBoost ML first filters columns and then LangGraph routes complex columns to the LLM agent.', badge: 'XGBoost/LangGraph' },
  { category: 'Central Database', name: 'PostgreSQL RDS', desc: 'Relational data engine storing profiles, metadata, active/proposed quality rules, and logging violations.', badge: 'Postgres' },
  { category: 'Database Connector', name: 'pg8000', desc: 'Pure-Python PostgreSQL driver, extremely lightweight, making lambda bundling simple without heavy binary compilation.', badge: 'pg8000 (Python)' },
  { category: 'Governance Frontend', name: 'Next.js App Router', desc: 'Human-in-the-loop web portal to review, filter, bulk-approve, or reject suggested quality rules.', badge: 'Next.js & Tailwind' }
];

// DB Schemas Details
export const DB_SCHEMAS = [
  {
    name: 'dq_profiles',
    desc: 'Houses statistical measurements computed by the Profiler Lambda for every column in the schema.',
    fields: [
      { name: 'table_name', type: 'VARCHAR(255)', desc: 'Name of the database table.' },
      { name: 'column_name', type: 'VARCHAR(255)', desc: 'Name of the specific column.' },
      { name: 'data_type', type: 'VARCHAR(100)', desc: 'PostgreSQL column type (e.g. integer, character varying).' },
      { name: 'total_rows', type: 'INTEGER', desc: 'Total row count in the table.' },
      { name: 'null_rate', type: 'NUMERIC(5,4)', desc: 'Fraction of rows that are null (0.00 to 1.00).' },
      { name: 'distinct_rate', type: 'NUMERIC(5,4)', desc: 'Fraction of unique values over total values.' },
      { name: 'min_value / max_value', type: 'VARCHAR(255)', desc: 'Lower and upper string bounds.' },
      { name: 'avg_value / stddev_value', type: 'NUMERIC', desc: 'Numerical stats for numeric types.' },
      { name: 'min_length / max_length', type: 'INTEGER', desc: 'String length bounds for string columns.' },
      { name: 'sample_values', type: 'JSONB', desc: 'Random selection of raw sample values for context.' }
    ]
  },
  {
    name: 'dq_rules_proposed',
    desc: 'Stores LLM-generated rules that have passed the automated self-correction checks but are awaiting human review.',
    fields: [
      { name: 'id', type: 'SERIAL PRIMARY KEY', desc: 'Unique record identifier.' },
      { name: 'table_name', type: 'VARCHAR(255)', desc: 'Target table to apply the rule.' },
      { name: 'column_name', type: 'VARCHAR(255)', desc: 'Target column.' },
      { name: 'rule_type', type: 'VARCHAR(100)', desc: 'Type of rule (e.g., min_value, email_format).' },
      { name: 'rule_config', type: 'JSONB', desc: 'Configuration arguments (e.g., {"min_value": 0}).' },
      { name: 'severity', type: 'VARCHAR(50)', desc: 'Severity of a violation (low, medium, high).' },
      { name: 'confidence', type: 'NUMERIC(3,2)', desc: 'LLM self-assessed probability of fit (0.0 to 1.0).' },
      { name: 'dq_type', type: 'VARCHAR(100)', desc: 'Data quality dimension classification.' },
      { name: 'generated_by', type: 'VARCHAR(255)', desc: 'Source of the rule (e.g., langgraph-agent).' },
      { name: 'created_at', type: 'TIMESTAMP', desc: 'Timestamp of proposal generation.' }
    ]
  },
  {
    name: 'dq_rules',
    desc: 'Contains active, human-approved rules that are continuously checked against incoming/existing records.',
    fields: [
      { name: 'id', type: 'SERIAL PRIMARY KEY', desc: 'Unique record identifier.' },
      { name: 'table_name', type: 'VARCHAR(255)', desc: 'Target table.' },
      { name: 'column_name', type: 'VARCHAR(255)', desc: 'Target column.' },
      { name: 'rule_type', type: 'VARCHAR(100)', desc: 'Type of rule to enforce.' },
      { name: 'rule_config', type: 'JSONB', desc: 'Validation parameters.' },
      { name: 'severity', type: 'VARCHAR(50)', desc: 'Severity level on failure.' },
      { name: 'confidence', type: 'NUMERIC(3,2)', desc: 'Initial creation confidence level.' },
      { name: 'dq_type', type: 'VARCHAR(100)', desc: 'Dimension classification.' },
      { name: 'generated_by', type: 'VARCHAR(255)', desc: 'Author / generator tag.' }
    ]
  },
  {
    name: 'dq_violations',
    desc: 'Records individual row failures detected by the Checker Lambda during dynamic execution checks.',
    fields: [
      { name: 'id', type: 'SERIAL PRIMARY KEY', desc: 'Unique record identifier.' },
      { name: 'table_name', type: 'VARCHAR(255)', desc: 'Table containing anomalous record.' },
      { name: 'column_name', type: 'VARCHAR(255)', desc: 'Column that failed check.' },
      { name: 'rule_type', type: 'VARCHAR(100)', desc: 'The failed validation rule.' },
      { name: 'offending_value', type: 'TEXT', desc: 'The actual malformed value extracted from the DB.' },
      { name: 'violation_details', type: 'JSONB', desc: 'Configuration reference and exact SQL query run.' },
      { name: 'dq_type', type: 'VARCHAR(100)', desc: 'Dimension of the failed quality parameter.' },
      { name: 'detected_at', type: 'TIMESTAMP', desc: 'Execution detection timestamp.' }
    ]
  }
];
