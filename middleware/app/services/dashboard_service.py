from app.db.connection import get_db_cursor, fetch_all_as_dicts, fetch_one_as_dict

class DashboardService:
    @staticmethod
    def get_metrics(tenant_id: str = "default") -> dict:
        with get_db_cursor() as cur:
            # 1. Active rules
            cur.execute("SELECT COUNT(*) as active_rules FROM dq_rules")
            rules_row = fetch_one_as_dict(cur)
            active_rules = int(rules_row.get("active_rules", 0)) if rules_row else 0

            # 2. Total anomalies
            cur.execute("SELECT COUNT(*) as total_anomalies FROM dq_violations")
            anomalies_row = fetch_one_as_dict(cur)
            total_anomalies = int(anomalies_row.get("total_anomalies", 0)) if anomalies_row else 0

            # 3. Monitored tables and total rows
            cur.execute("""
                SELECT COALESCE(SUM(max_rows), 0) as total_rows, COUNT(*) as tables_monitored 
                FROM (
                    SELECT table_name, MAX(total_rows) as max_rows FROM dq_profiles GROUP BY table_name
                ) as unique_tables
            """)
            prof_row = fetch_one_as_dict(cur)
            total_rows = int(prof_row.get("total_rows", 0)) if prof_row else 0
            tables_monitored = int(prof_row.get("tables_monitored", 0)) if prof_row else 0

            # 4. Health score calculation
            health_score = 100.0
            if total_rows > 0:
                health_score = max(0.0, 100.0 - ((total_anomalies / total_rows) * 100.0))

            return {
                "activeRules": active_rules,
                "totalAnomalies": total_anomalies,
                "tablesMonitored": tables_monitored,
                "healthScore": round(health_score, 2)
            }

    @staticmethod
    def get_tables(tenant_id: str = "default") -> list[dict]:
        with get_db_cursor() as cur:
            query = """
                SELECT 
                    p.table_name,
                    MAX(p.total_rows) as total_rows,
                    COALESCE(r.active_rules, 0) as active_rules,
                    COALESCE(v.total_anomalies, 0) as total_anomalies
                FROM dq_profiles p
                LEFT JOIN (
                    SELECT table_name, COUNT(*) as active_rules FROM dq_rules GROUP BY table_name
                ) r ON p.table_name = r.table_name
                LEFT JOIN (
                    SELECT table_name, COUNT(*) as total_anomalies FROM dq_violations GROUP BY table_name
                ) v ON p.table_name = v.table_name
                GROUP BY p.table_name, r.active_rules, v.total_anomalies
                ORDER BY total_anomalies DESC, p.table_name ASC
            """
            cur.execute(query)
            rows = fetch_all_as_dicts(cur)

            tables = []
            for row in rows:
                total_rows = int(row.get("total_rows") or 0)
                total_anomalies = int(row.get("total_anomalies") or 0)
                health_score = 100.0
                if total_rows > 0:
                    health_score = max(0.0, 100.0 - ((total_anomalies / total_rows) * 100.0))

                tables.append({
                    "table_name": row["table_name"],
                    "total_rows": total_rows,
                    "active_rules": int(row.get("active_rules") or 0),
                    "total_anomalies": total_anomalies,
                    "health_score": round(health_score, 2)
                })

            return tables

dashboard_service = DashboardService()
