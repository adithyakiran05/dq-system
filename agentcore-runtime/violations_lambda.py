import os
import json
import pg8000
from datetime import datetime

def get_connection():
    return pg8000.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ["DB_PORT"]),
        database=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"]
    )

def lambda_handler(event, context):
    conn = get_connection()
    cur = conn.cursor()
    
    # Fetch all rules
    cur.execute("SELECT table_name, column_name, rule_type, rule_config, dq_type FROM dq_rules")
    rules = cur.fetchall()
    
    violations_found = 0
    
    for rule in rules:
        table_name = rule[0]
        column_name = rule[1]
        rule_type = rule[2]
        rule_config_str = rule[3]
        dq_type = rule[4] if len(rule) > 4 and rule[4] else None
        
        try:
            # handle both string and dict depending on how it's stored or returned
            if isinstance(rule_config_str, str):
                rule_config = json.loads(rule_config_str) if rule_config_str else {}
            else:
                rule_config = rule_config_str or {}
        except:
            rule_config = {}
            
        where_clause = None
        
        # Determine the WHERE clause based on rule_type
        rt_lower = rule_type.lower()
        
        # Null checks
        if rt_lower in ('not_null', 'null_values'):
            where_clause = f"{column_name} IS NULL"
            
        # Unique checks
        elif rt_lower in ('unique', 'unique_values', 'unique_value', 'integer_uniqueness', 'password_uniqueness', 'distinct_values') or 'unique' in rt_lower:
            where_clause = f"{column_name} IN (SELECT {column_name} FROM {table_name} GROUP BY {column_name} HAVING COUNT(*) > 1)"
            
        # Range checks (min/max)
        elif rt_lower in ('min_value', 'max_value', 'min_max_value', 'value_range', 'numeric_range', 'integer_value_range', 'integer_range', 'date_range'):
            min_val = rule_config.get('min_value', rule_config.get('min'))
            max_val = rule_config.get('max_value', rule_config.get('max'))
            conditions = []
            if min_val is not None:
                conditions.append(f"{column_name} < '{min_val}'")
            if max_val is not None:
                conditions.append(f"{column_name} > '{max_val}'")
            if conditions:
                where_clause = " OR ".join(conditions)
                
        # Length checks
        elif 'length' in rt_lower or 'between' in rt_lower:
            min_len = rule_config.get('min_length', rule_config.get('min'))
            max_len = rule_config.get('max_length', rule_config.get('max'))
            
            # Try to extract from string like "Length should be between 3 and 20"
            if min_len is None and max_len is None and 'between' in rt_lower:
                import re
                nums = re.findall(r'\d+', rt_lower)
                if len(nums) >= 2:
                    min_len, max_len = nums[0], nums[1]
                    
            conditions = []
            if min_len is not None:
                conditions.append(f"LENGTH({column_name}::text) < {min_len}")
            if max_len is not None:
                conditions.append(f"LENGTH({column_name}::text) > {max_len}")
            if conditions:
                where_clause = " OR ".join(conditions)
                
        # List of accepted values
        elif rt_lower in ('accepted_values', 'value_in_list'):
            values = rule_config.get('values', [])
            if values:
                vals_str = ", ".join([f"'{v}'" if isinstance(v, str) else str(v) for v in values])
                where_clause = f"{column_name} NOT IN ({vals_str})"
                
        # Email format
        elif rt_lower == 'email_format':
            where_clause = f"{column_name} !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{{2,}}$'"
            
        # Regex
        elif rt_lower == 'regex_match':
            regex = rule_config.get('regex')
            if regex:
                where_clause = f"{column_name} !~ '{regex}'"
                
        # Boolean check
        elif rt_lower == 'valid_boolean_value':
            where_clause = f"{column_name}::text NOT IN ('true', 'false', 't', 'f', '1', '0', 'yes', 'no', 'y', 'n')"
                
        if not where_clause:
            print(f"Skipping unsupported or incomplete rule: {rule_type} on {table_name}.{column_name}")
            continue
            
        # Execute query to find violations
        query = f"SELECT {column_name} FROM {table_name} WHERE {where_clause} LIMIT 100"
        
        try:
            cur.execute(query)
            offenders = cur.fetchall()
            
            for offender in offenders:
                offending_value = str(offender[0])
                violation_details = json.dumps({"rule_config": rule_config, "query": query})
                
                # Insert into dq_violations
                insert_query = """
                    INSERT INTO dq_violations (
                        table_name, column_name, rule_type, offending_value, violation_details, detected_at, dq_type
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """
                cur.execute(insert_query, (
                    table_name, column_name, rule_type, offending_value, violation_details, datetime.now(), dq_type
                ))
                violations_found += 1
                
        except Exception as e:
            print(f"Error executing rule {rule_type} on {table_name}.{column_name}: {e}")
            conn.rollback() # Rollback the transaction on error so we can continue with the next rule
            continue
            
    conn.commit()
    conn.close()
    
    return {
        'statusCode': 200,
        'body': json.dumps({"message": "Validation complete", "violations_found": violations_found})
    }
