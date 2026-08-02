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
      AND t.table_name NOT IN ('dq_rules', 'dq_rules_proposed', 'dq_profiles')
    ORDER BY c.table_name, c.column_name
    """

    cur = conn.cursor()
    cur.execute(sql)

    return cur.fetchall()


def get_profile(conn, table, column, datatype):

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

        sql = f"""
        SELECT
            COUNT(*) total_rows,

            COUNT(*) FILTER (
                WHERE "{column}" IS NULL
            ) null_count,

            COUNT(DISTINCT "{column}") distinct_count,

            MIN("{column}")::TEXT,
            MAX("{column}")::TEXT,

            AVG("{column}"),
            STDDEV("{column}"),

            NULL,
            NULL

        FROM "{table}"
        """

    elif (
        "timestamp" in datatype
        or datatype == "date"
        or "time" in datatype
    ):

        sql = f"""
        SELECT
            COUNT(*) total_rows,

            COUNT(*) FILTER (
                WHERE "{column}" IS NULL
            ) null_count,

            COUNT(DISTINCT "{column}") distinct_count,

            MIN("{column}")::TEXT,
            MAX("{column}")::TEXT,

            NULL,
            NULL,

            NULL,
            NULL

        FROM "{table}"
        """

    else:

        sql = f"""
        SELECT
            COUNT(*) total_rows,

            COUNT(*) FILTER (
                WHERE "{column}" IS NULL
            ) null_count,

            COUNT(DISTINCT "{column}") distinct_count,

            MIN("{column}"::TEXT),
            MAX("{column}"::TEXT),

            NULL,
            NULL,

            MIN(LENGTH("{column}"::TEXT)),
            MAX(LENGTH("{column}"::TEXT))

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

        return [
            str(r[0])
            for r in rows
        ]

    except Exception as e:

        print(
            f"SAMPLE FAILED {table}.{column}: {e}"
        )

        return []


def save_profile(
    conn,

    table,
    column,
    datatype,

    total_rows,

    null_count,
    distinct_count,

    min_value,
    max_value,

    avg_value,
    stddev_value,

    min_length,
    max_length,

    samples
):

    null_rate = (
        float(null_count) / float(total_rows)
        if total_rows > 0 else 0
    )

    distinct_rate = (
        float(distinct_count) / float(total_rows)
        if total_rows > 0 else 0
    )

    sql = """
    INSERT INTO dq_profiles(

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

    cur.execute(
        sql,
        (
            table,
            column,
            datatype,

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

            json.dumps(samples)
        )
    )


def lambda_handler(event, context):

    conn = get_connection()

    success = 0
    failed = 0

    try:

        columns = get_columns(conn)

        print(
            f"Found {len(columns)} columns"
        )

        for table, column, datatype in columns:

            print(
                f"Profiling {table}.{column} ({datatype})"
            )

            try:

                (
                    total_rows,
                    null_count,
                    distinct_count,

                    min_value,
                    max_value,

                    avg_value,
                    stddev_value,

                    min_length,
                    max_length

                ) = get_profile(
                    conn,
                    table,
                    column,
                    datatype
                )

                samples = get_samples(
                    conn,
                    table,
                    column
                )

                save_profile(
                    conn,

                    table,
                    column,
                    datatype,

                    total_rows,

                    null_count,
                    distinct_count,

                    min_value,
                    max_value,

                    avg_value,
                    stddev_value,

                    min_length,
                    max_length,

                    samples
                )

                conn.commit()

                success += 1

            except Exception as e:

                print(
                    f"FAILED: {table}.{column}"
                )

                print(str(e))

                try:
                    conn.rollback()
                except:
                    pass

                failed += 1

        return {
            "statusCode": 200,
            "success": success,
            "failed": failed
        }

    finally:

        conn.close()
