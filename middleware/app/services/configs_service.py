from app.db.connection import get_db_cursor, fetch_all_as_dicts

class ConfigsService:
    @staticmethod
    def list_configs(tenant_id: str = "default") -> list[dict]:
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM dq_custom_configs ORDER BY created_at DESC")
            return fetch_all_as_dicts(cur)

    @staticmethod
    def save_config(config_text: str, tenant_id: str = "default") -> int:
        with get_db_cursor() as cur:
            cur.execute("INSERT INTO dq_custom_configs (config_text) VALUES (%s) RETURNING id", (config_text,))
            row = cur.fetchone()
            return row[0] if row else 0

    @staticmethod
    def delete_config(config_id: int, tenant_id: str = "default") -> bool:
        with get_db_cursor() as cur:
            cur.execute("DELETE FROM dq_custom_configs WHERE id = %s", (config_id,))
            return True

configs_service = ConfigsService()
