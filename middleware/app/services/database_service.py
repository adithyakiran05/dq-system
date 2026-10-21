import re
from app.db.connection import get_db_cursor, fetch_all_as_dicts

IDENTIFIER_REGEX = re.compile(r"^[a-zA-Z0-9_]+$")

class DatabaseService:
    @staticmethod
    def get_profiles_grouped(tenant_id: str = "default") -> dict:
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM dq_profiles ORDER BY table_name, column_name")
            rows = fetch_all_as_dicts(cur)

            grouped = {}
            for row in rows:
                t_name = row.get("table_name")
                if t_name not in grouped:
                    grouped[t_name] = []
                grouped[t_name].append(row)
            return grouped

    @staticmethod
    def insert_record(table_name: str, payload: dict) -> dict:
        if not table_name or not payload:
            raise ValueError("Table name and non-empty payload are required")

        columns = list(payload.keys())
        values = list(payload.values())

        # Security: strictly validate table and column names
        if not IDENTIFIER_REGEX.match(table_name):
            raise ValueError(f"Invalid table name identifier: '{table_name}'")

        for col in columns:
            if not IDENTIFIER_REGEX.match(col):
                raise ValueError(f"Invalid column name identifier: '{col}'")

        columns_str = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(values))
        sql = f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders}) RETURNING *"

        with get_db_cursor() as cur:
            cur.execute(sql, tuple(values))
            columns_ret = [desc[0] for desc in cur.description]
            row = cur.fetchone()
            return dict(zip(columns_ret, row)) if row else {}

database_service = DatabaseService()
