import os
import json
import pg8000
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return pg8000.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", 5432)),
        database=os.environ.get("DB_NAME", "postgres"),
        user=os.environ.get("DB_USER", "postgres"),
        password=os.environ.get("DB_PASSWORD", "")
    )

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

    return [
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
    ]

def save_rules_bulk(rules: list):
    """
    rules: [{"table_name", "column_name", "rule_type", "rule_config", "severity", "confidence", "dq_type", "generated_by"}]
    """
    if not rules:
        return
        
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
                %s,%s,%s,%s,%s,%s,%s,%s
            )
        """,
        (
            rule["table_name"],
            rule["column_name"],
            rule["rule_type"],
            json.dumps(rule.get("rule_config", {})),
            rule.get("severity", "medium"),
            rule.get("confidence", 0.9),
            rule.get("generated_by", "agent 2 rule based"),
            rule.get("dq_type", "general")
        ))
        inserted += 1
        
    conn.commit()
    conn.close()
    return inserted

class DQRuleEngine:
    def __init__(self):
        self.standard_rules = {
            "email": {"rule_type": "regex_match", "rule_config": {"regex": "^[^@]+@[^@]+\\.[^@]+$"}, "dq_type": "Validity", "severity": "high", "confidence": 0.95},
            "created_at": {"rule_type": "not_null", "rule_config": {}, "dq_type": "Completeness", "severity": "high", "confidence": 0.90},
            "updated_at": {"rule_type": "not_null", "rule_config": {}, "dq_type": "Completeness", "severity": "high", "confidence": 0.90},
            "is_active": {"rule_type": "accepted_values", "rule_config": {"values": ["true", "false", "1", "0"]}, "dq_type": "Validity", "severity": "high", "confidence": 0.90}
        }

    def evaluate(self, profile):
        col_name = profile.get("column_name", "").lower()
        rules = []

        # 1. Primary Key / ID checks (Unique + Not Null)
        if col_name == "id" or (col_name.endswith("_id") and profile.get("distinct_rate", 0) >= 0.95):
            rules.append({"rule_type": "unique", "rule_config": {}, "dq_type": "Uniqueness", "severity": "high", "confidence": 0.95})
            if profile.get("null_rate", 0) == 0:
                rules.append({"rule_type": "not_null", "rule_config": {}, "dq_type": "Completeness", "severity": "high", "confidence": 0.95})
            return rules

        # 2. Check for standard column names
        for key, rule in self.standard_rules.items():
            if key in col_name:
                rules.append(rule.copy())
                return rules
        
        return None
