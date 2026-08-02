import os
import json
from fastmcp import FastMCP
import pg8000.dbapi

mcp = FastMCP("dqmcp")

def get_connection():
    return pg8000.dbapi.connect(
        host=os.environ.get("DB_HOST", "postgres.cqbucwq2y92h.us-east-1.rds.amazonaws.com"),
        port=int(os.environ.get("DB_PORT", 5432)),
        database=os.environ.get("DB_NAME", "postgres"),
        user=os.environ.get("DB_USER", "postgres"),
        password=os.environ.get("DB_PASSWORD", "YourPassword123!")
    )

@mcp.tool()
def get_profiles(table_name: str) -> str:
    """Fetch the profiling data for a given table to be used for rule generation."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT column_name, data_type, total_rows, null_count, null_rate, distinct_count, distinct_rate, min_value, max_value, avg_value, stddev_value, min_length, max_length, sample_values FROM dq_profiles WHERE table_name = %s", (table_name,))
        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description]
        results = []
        for row in rows:
            results.append(dict(zip(columns, row)))
        return json.dumps(results, indent=2, default=str)
    except Exception as e:
        return f"Error: {e}"
    finally:
        conn.close()

@mcp.tool()
def save_proposed_rules(rules_json: str) -> str:
    """
    Save proposed data quality rules to the dq_rules_proposed table.
    rules_json should be a JSON string of a list of objects with keys:
    table_name, column_name, rule_type, rule_config, severity, confidence, generated_by, dq_type.
    """
    conn = get_connection()
    try:
        rules = json.loads(rules_json)
        cur = conn.cursor()
        
        insert_query = """
            INSERT INTO dq_rules_proposed (
                table_name, column_name, rule_type, rule_config, 
                severity, confidence, generated_by, dq_type, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        """
        
        for rule in rules:
            cur.execute(
                insert_query,
                (
                    rule.get('table_name'),
                    rule.get('column_name'),
                    rule.get('rule_type'),
                    json.dumps(rule.get('rule_config', {})),
                    rule.get('severity', 'high'),
                    rule.get('confidence', 0.9),
                    rule.get('generated_by', 'dqagent'),
                    rule.get('dq_type')
                )
            )
            
        conn.commit()
        return f"Successfully saved {len(rules)} rules."
    except Exception as e:
        conn.rollback()
        return f"Error: {e}"
    finally:
        conn.close()

if __name__ == "__main__":
    mcp.run(transport='stdio')
