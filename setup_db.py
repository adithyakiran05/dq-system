import pg8000.native
import sys
import os

def connect(host, user, password, database):
    return pg8000.native.Connection(host=host, user=user, password=password, database=database)

def run_script(conn, filename):
    with open(filename, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    print(f"Executing {filename}...")
    try:
        # Some pagila scripts have multi-statements. We will split by semicolon for execution.
        # But wait, splitting by semicolon can break if semicolons are inside strings.
        # Let's try running it as one block first.
        conn.run(sql)
        print(f"Successfully executed {filename}")
    except Exception as e:
        # pg8000 native might not support multiple statements well, so we might need a parser or psql.
        print(f"Error executing {filename}: {e}")

def setup_dq_tables(conn):
    print("Setting up DQ custom tables...")
    try:
        conn.run("""
            CREATE TABLE IF NOT EXISTS dq_profiles (
                id SERIAL PRIMARY KEY,
                profile_name VARCHAR(255) NOT NULL,
                tables JSONB NOT NULL
            );
        """)
        conn.run("""
            CREATE TABLE IF NOT EXISTS dq_rules_proposed (
                id SERIAL PRIMARY KEY,
                profile_name VARCHAR(255) NOT NULL,
                table_name VARCHAR(255) NOT NULL,
                column_name VARCHAR(255) NOT NULL,
                rule_name VARCHAR(255) NOT NULL,
                rule_sql TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'proposed',
                generated_by VARCHAR(255) DEFAULT 'agent1',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.run("""
            CREATE TABLE IF NOT EXISTS dq_custom_configs (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                s3_uri VARCHAR(1024) NOT NULL,
                parsed_configs JSONB NOT NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.run("""
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
        """)
        print("Successfully set up DQ tables.")
    except Exception as e:
        print(f"Error setting up DQ tables: {e}")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python setup_db.py <db_host>")
        sys.exit(1)
        
    db_host = sys.argv[1]
    
    conn = connect(db_host, 'postgres', 'YourPassword123!', 'postgres')
    
    run_script(conn, 'pagila-schema.sql')
    run_script(conn, 'pagila-data.sql')
    setup_dq_tables(conn)
    
    conn.close()
