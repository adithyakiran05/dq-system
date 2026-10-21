DROP TABLE IF EXISTS dq_profiles CASCADE;
DROP TABLE IF EXISTS dq_custom_configs CASCADE;
DROP TABLE IF EXISTS dq_rules_proposed CASCADE;

CREATE TABLE IF NOT EXISTS dq_profiles (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255),
    column_name VARCHAR(255),
    data_type VARCHAR(100),
    total_rows INTEGER,
    null_count INTEGER,
    null_rate DECIMAL,
    distinct_count INTEGER,
    distinct_rate DECIMAL,
    min_value VARCHAR(255),
    max_value VARCHAR(255),
    avg_value DECIMAL,
    stddev_value DECIMAL,
    min_length INTEGER,
    max_length INTEGER,
    sample_values JSONB,
    profiled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dq_custom_configs (
    id SERIAL PRIMARY KEY,
    config_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dq_rules_proposed (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255),
    column_name VARCHAR(255),
    rule_type VARCHAR(100),
    rule_config JSONB,
    severity VARCHAR(50),
    confidence DECIMAL,
    generated_by VARCHAR(255),
    dq_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'proposed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dq_violations (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(100) NOT NULL,
    offending_value TEXT,
    violation_details JSONB,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dq_type VARCHAR(100)
);
