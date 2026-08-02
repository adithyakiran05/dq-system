import os
import json
import pg8000


def get_connection():
    return pg8000.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"]
    )


def get_columns(conn):

    sql = """
    SELECT
        c.table_name,
        c.column_name,
        c.data_type
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON c.table_name = t.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND t.table_name NOT IN ('dq_rules', 'dq_profiles', 'dq_rules_proposed', 'dq_violations')
    ORDER BY c.table_name, c.column_name
    """

    cur = conn.cursor()
    cur.execute(sql)

    return cur.fetchall()


def get_type_group(datatype):

    datatype = datatype.lower()

    numeric_types = {
        "integer",
        "smallint",
        "bigint",
        "numeric",
        "decimal",
        "real",
        "double precision"
    }

    if datatype in numeric_types:
        return "numeric"

    if "timestamp" in datatype:
        return "date"

    if "date" in datatype:
        return "date"

    if "time" in datatype:
        return "date"

    return "text"


def profile_numeric(conn, table, column):

    sql = f"""
    SELECT
        COUNT(*) as total_rows,
        COUNT(*) FILTER (
            WHERE "{column}" IS NULL
        ) as null_count,
        COUNT(DISTINCT "{column}") as distinct_count,
        MIN("{column}"),
        MAX("{column}"),
        AVG("{column}"),
        STDDEV("{column}")
    FROM "{table}"
    """

    cur = conn.cursor()
    cur.execute(sql)

    return cur.fetchone()


def profile_date(conn, table, column):

    sql = f"""
    SELECT
        COUNT(*) as total_rows,
        COUNT(*) FILTER (
            WHERE "{column}" IS NULL
        ) as null_count,
        COUNT(DISTINCT "{column}") as distinct_count,
        MIN("{column}"),
        MAX("{column}")
    FROM "{table}"
    """

    cur = conn.cursor()
    cur.execute(sql)

    return cur.fetchone()


def profile_text(conn, table, column):

    sql = f"""
    SELECT
        COUNT(*) as total_rows,
        COUNT(*) FILTER (
            WHERE "{column}" IS NULL
        ) as null_count,
        COUNT(DISTINCT "{column}") as distinct_count,
        MIN("{column}"),
        MAX("{column}"),
        MIN(LENGTH("{column}")),
        MAX(LENGTH("{column}"))
    FROM "{table}"
    """

    cur = conn.cursor()
    cur.execute(sql)

    return cur.fetchone()


def get_samples(conn, table, column):

    sql = f"""
    SELECT "{column}"
    FROM "{table}"
    WHERE "{column}" IS NOT NULL
    LIMIT 5
    """

    cur = conn.cursor()

    try:
        cur.execute(sql)
        rows = cur.fetchall()

        return [str(r[0]) for r in rows]

    except Exception as e:
        print(f"Sample error {table}.{column}: {e}")
        return []


def save_profile(conn, profile):

    sql = """
    INSERT INTO dq_profiles (
        table_name,
        column_name,
        data_type,

        total_rows,

        null_count,
        null_rate,

        distinct_count,
        distinct_rate,

        min_value,
        max_value,

        avg_value,
        stddev_value,

        min_length,
        max_length,

        sample_values
    )
    VALUES (
        %s,%s,%s,
        %s,
        %s,%s,
        %s,%s,
        %s,%s,
        %s,%s,
        %s,%s,
        %s
    )
    """

    cur = conn.cursor()
    cur.execute(sql, profile)


def lambda_handler(event, context):

    conn = get_connection()

    try:

        columns = get_columns(conn)

        print(f"Found {len(columns)} columns")

        for table, column, datatype in columns:

            print(
                f"Profiling {table}.{column} ({datatype})"
            )

            try:

                samples = get_samples(
                    conn,
                    table,
                    column
                )

                group = get_type_group(datatype)

                if group == "numeric":

                    (
                        total_rows,
                        null_count,
                        distinct_count,
                        min_value,
                        max_value,
                        avg_value,
                        stddev_value
                    ) = profile_numeric(
                        conn,
                        table,
                        column
                    )

                    min_length = None
                    max_length = None

                elif group == "date":

                    (
                        total_rows,
                        null_count,
                        distinct_count,
                        min_value,
                        max_value
                    ) = profile_date(
                        conn,
                        table,
                        column
                    )

                    avg_value = None
                    stddev_value = None

                    min_length = None
                    max_length = None

                else:

                    (
                        total_rows,
                        null_count,
                        distinct_count,
                        min_value,
                        max_value,
                        min_length,
                        max_length
                    ) = profile_text(
                        conn,
                        table,
                        column
                    )

                    avg_value = None
                    stddev_value = None

                null_rate = (
                    float(null_count) / float(total_rows)
                    if total_rows else 0
                )

                distinct_rate = (
                    float(distinct_count) / float(total_rows)
                    if total_rows else 0
                )

                save_profile(
                    conn,
                    (
                        table,
                        column,
                        datatype,

                        total_rows,

                        null_count,
                        null_rate,

                        distinct_count,
                        distinct_rate,

                        str(min_value)
                        if min_value is not None
                        else None,

                        str(max_value)
                        if max_value is not None
                        else None,

                        avg_value,
                        stddev_value,

                        min_length,
                        max_length,

                        json.dumps(samples)
                    )
                )
                conn.commit()

            except Exception as e:

                print(
                    f"Skipping {table}.{column}: {e}"
                )
                conn.rollback()
                continue

        return {
            "statusCode": 200,
            "message": "Profiling Complete"
        }

    finally:
        conn.close()