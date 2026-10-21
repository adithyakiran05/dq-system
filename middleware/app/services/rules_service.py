import json
from app.db.connection import get_db_cursor, fetch_all_as_dicts, fetch_one_as_dict

class RulesService:
    @staticmethod
    def get_proposed_rules(tenant_id: str = "default") -> list[dict]:
        with get_db_cursor() as cur:
            cur.execute("""
                SELECT * FROM dq_rules_proposed 
                WHERE status = 'proposed' 
                ORDER BY created_at DESC
            """)
            return fetch_all_as_dicts(cur)

    @staticmethod
    def approve_rule(rule_id: int, tenant_id: str = "default") -> bool:
        with get_db_cursor() as cur:
            cur.execute("""
                INSERT INTO dq_rules (
                    table_name, column_name, rule_type, rule_config,
                    severity, confidence, generated_by, dq_type
                )
                SELECT 
                    table_name, column_name, rule_type, rule_config,
                    severity, confidence, generated_by, dq_type
                FROM dq_rules_proposed
                WHERE id = %s AND status = 'proposed'
            """, (rule_id,))

            cur.execute("UPDATE dq_rules_proposed SET status = 'approved' WHERE id = %s", (rule_id,))
            return True

    @staticmethod
    def approve_all_rules(rule_ids: list[int], tenant_id: str = "default") -> int:
        if not rule_ids:
            return 0

        with get_db_cursor() as cur:
            placeholders = ", ".join(["%s"] * len(rule_ids))
            cur.execute(f"""
                INSERT INTO dq_rules (
                    table_name, column_name, rule_type, rule_config,
                    severity, confidence, generated_by, dq_type
                )
                SELECT 
                    table_name, column_name, rule_type, rule_config,
                    severity, confidence, generated_by, dq_type
                FROM dq_rules_proposed
                WHERE id IN ({placeholders}) AND status = 'proposed'
            """, tuple(rule_ids))

            cur.execute(f"UPDATE dq_rules_proposed SET status = 'approved' WHERE id IN ({placeholders})", tuple(rule_ids))
            return len(rule_ids)

    @staticmethod
    def reject_rule(rule_id: int, tenant_id: str = "default") -> bool:
        with get_db_cursor() as cur:
            cur.execute("UPDATE dq_rules_proposed SET status = 'rejected' WHERE id = %s", (rule_id,))
            return True

    @staticmethod
    def reject_all_rules(rule_ids: list[int], tenant_id: str = "default") -> int:
        if not rule_ids:
            return 0
        with get_db_cursor() as cur:
            placeholders = ", ".join(["%s"] * len(rule_ids))
            cur.execute(f"UPDATE dq_rules_proposed SET status = 'rejected' WHERE id IN ({placeholders})", tuple(rule_ids))
            return len(rule_ids)

    @staticmethod
    def update_rule(rule_id: int, rule_config: any, tenant_id: str = "default") -> bool:
        if isinstance(rule_config, dict):
            rule_config = json.dumps(rule_config)
            
        with get_db_cursor() as cur:
            cur.execute("UPDATE dq_rules_proposed SET rule_config = %s WHERE id = %s", (rule_config, rule_id))
            return True

    @staticmethod
    def get_summary(tenant_id: str = "default") -> dict:
        with get_db_cursor() as cur:
            cur.execute("SELECT COUNT(*) as count FROM dq_rules")
            row = fetch_one_as_dict(cur)
            count = int(row.get("count", 0)) if row else 0
            return {"approvedCount": count}

    @staticmethod
    def get_history(tenant_id: str = "default") -> list[dict]:
        with get_db_cursor() as cur:
            cur.execute("""
                SELECT 
                    DATE_TRUNC('minute', created_at) as generation_time,
                    generated_by,
                    COUNT(*) as total_generated,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
                    SUM(CASE WHEN status = 'proposed' THEN 1 ELSE 0 END) as pending_count
                FROM dq_rules_proposed
                GROUP BY DATE_TRUNC('minute', created_at), generated_by
                ORDER BY generation_time DESC
            """)
            return fetch_all_as_dicts(cur)

rules_service = RulesService()
