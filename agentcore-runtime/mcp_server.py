import os
import json
import pg8000

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

load_dotenv()

mcp = FastMCP("DQAgent")


def get_connection():

    return pg8000.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"]
    )

def init_tables():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS dq_rules_proposed (
            id SERIAL PRIMARY KEY,
            table_name VARCHAR(255),
            column_name VARCHAR(255),
            rule_type VARCHAR(255),
            rule_config JSONB,
            severity VARCHAR(50),
            confidence NUMERIC,
            generated_by VARCHAR(255),
            dq_type VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

try:
    init_tables()
except Exception as e:
    print(f"Warning: Failed to init tables: {e}")


@mcp.tool()
def get_profiles():

    conn = get_connection()

    cur = conn.cursor()

    cur.execute("""
        SELECT
            table_name,
            column_name,
            data_type,
            total_rows,
            null_rate,
            distinct_rate,
            min_value,
            max_value,
            avg_value,
            stddev_value,
            min_length,
            max_length,
            sample_values
        FROM dq_profiles
    """)

    rows = cur.fetchall()

    conn.close()

    return json.dumps([
        {
            "table_name": r[0],
            "column_name": r[1],
            "data_type": r[2],
            "total_rows": r[3],
            "null_rate": float(r[4]) if r[4] is not None else None,
            "distinct_rate": float(r[5]) if r[5] is not None else None,
            "min_value": r[6],
            "max_value": r[7],
            "avg_value": float(r[8]) if r[8] is not None else None,
            "stddev_value": float(r[9]) if r[9] is not None else None,
            "min_length": r[10],
            "max_length": r[11],
            "sample_values": r[12]
        }
        for r in rows
    ], default=str)


@mcp.tool()
def get_profile(
    table_name: str,
    column_name: str
):

    conn = get_connection()

    cur = conn.cursor()

    cur.execute("""
        SELECT
            table_name,
            column_name,
            data_type,
            total_rows,
            null_rate,
            distinct_rate,
            min_value,
            max_value,
            avg_value,
            stddev_value,
            min_length,
            max_length,
            sample_values
        FROM dq_profiles
        WHERE table_name=%s
        AND column_name=%s
    """, (table_name, column_name))

    row = cur.fetchone()

    conn.close()

    return json.dumps(row, default=str)


@mcp.tool()
def get_existing_rules():

    conn = get_connection()

    cur = conn.cursor()

    cur.execute("""
        SELECT
            table_name,
            column_name,
            rule_type
        FROM dq_rules
    """)

    rows = cur.fetchall()

    conn.close()

    return json.dumps(rows)

@mcp.tool()
def save_rule(
    table_name: str,
    column_name: str,
    rule_type: str,
    severity: str,
    confidence: float,
    rule_config: str = "{}",
    dq_type: str = "general"
):

    conn = get_connection()

    cur = conn.cursor()

    cur.execute("""
        INSERT INTO dq_rules(
            table_name,
            column_name,
            rule_type,
            rule_config,
            severity,
            confidence,
            generated_by,
            dq_type
        )
        VALUES(
            %s,%s,%s,%s,%s,%s,'bedrock-agent',%s
        )
    """,
    (
        table_name,
        column_name,
        rule_type,
        rule_config,
        severity,
        confidence,
        dq_type
    ))

    conn.commit()
    conn.close()

    return "saved"

@mcp.tool()
def save_rules_bulk(rules_json: str):

    rules = json.loads(rules_json)

    conn = get_connection()

    cur = conn.cursor()

    inserted = 0

    for rule in rules:

        cur.execute("""
            INSERT INTO dq_rules_proposed(
                table_name,
                column_name,
                rule_type,
                rule_config,
                severity,
                confidence,
                generated_by,
                dq_type
            )
            VALUES(
                %s,%s,%s,%s,%s,%s,'bedrock-agent',%s
            )
        """,
        (
            rule["table_name"],
            rule["column_name"],
            rule["rule_type"],
            json.dumps(
                rule.get("rule_config", {})
            ),
            rule["severity"],
            rule["confidence"],
            rule.get("dq_type", "general")
        ))

        inserted += 1

    conn.commit()
    conn.close()

    return f"Inserted {inserted} rules"

if __name__ == "__main__":

    mcp.run(
        transport="streamable-http",
        host="0.0.0.0"
    )