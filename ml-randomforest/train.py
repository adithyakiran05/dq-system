import pandas as pd
import random
from ml_model import DQMachineLearningModel

def generate_synthetic_data():
    """
    Generates a robust synthetic dataset tailored to the shapes found in the
    real PostgreSQL database (e.g. sakila/pagila schema).
    """
    data = []
    
    # 1. NOT_NULL rules (e.g., first_name, last_name, last_update)
    # They have 0 null rate, but distinct rate can be anything from 0.005 to 0.99
    for _ in range(3000):
        data.append({
            "total_rows": random.randint(200, 100000),
            "null_rate": 0.0,
            "distinct_rate": random.uniform(0.005, 0.99),
            "min_length": random.choice([0, 2, 3]), 
            "max_length": random.choice([0, 11, 20, 50]),
            "data_type": random.choice(["integer", "text", "timestamp with time zone", "numeric"]),
            "target_rule_type": "not_null"
        })
        
    # 2. UNIQUE rules (e.g., actor_id, address_id, city_id)
    # They have 0 null rate and exactly or near 1.0 distinct rate
    for _ in range(3000):
        data.append({
            "total_rows": random.randint(200, 100000),
            "null_rate": 0.0,
            "distinct_rate": random.uniform(0.99, 1.0),
            "min_length": 0, "max_length": 0,
            "data_type": random.choice(["integer", "bigint", "uuid"]),
            "target_rule_type": "unique"
        })
        
    # 3. LENGTH rules (e.g., fixed length codes like country_code 'US')
    for _ in range(2000):
        fixed_len = random.randint(2, 5)
        data.append({
            "total_rows": random.randint(200, 10000),
            "null_rate": random.uniform(0.0, 0.05), # minor nulls allowed
            "distinct_rate": random.uniform(0.01, 0.2),
            "min_length": fixed_len, "max_length": fixed_len,
            "data_type": random.choice(["text", "character varying"]),
            "target_rule_type": "length"
        })
        
    # 4. NONE (e.g., address2 which has some nulls and mostly empty strings, or unstructured data)
    # These should fall back to the agent for complex analysis
    for _ in range(4000):
        data.append({
            "total_rows": random.randint(200, 100000),
            "null_rate": random.uniform(0.001, 0.99), # > 0 nulls usually disqualifies simple not_null
            "distinct_rate": random.uniform(0.001, 0.98),
            "min_length": random.randint(0, 5), "max_length": random.randint(5, 100),
            "data_type": random.choice(["text", "numeric", "jsonb", "timestamp with time zone"]),
            "target_rule_type": "none"
        })
        
    df = pd.DataFrame(data)
    df = df.sample(frac=1).reset_index(drop=True)
    return df

if __name__ == "__main__":
    print("Generating tailored synthetic data (12,000 rows)...")
    df = generate_synthetic_data()
    
    print("Training Random Forest Classifier on DB patterns...")
    model = DQMachineLearningModel(confidence_threshold=0.85) # Increased confidence for real deployment
    model.train(df)
    print("Model trained and saved as dq_rf_model.pkl!")
    
    print("\n--- Testing Against Real DB Profiles ---")
    
    # Real profile: actor_id
    test_actor_id = {
        "table_name": "actor", "column_name": "actor_id", "data_type": "integer",
        "total_rows": 200, "null_rate": 0.0, "distinct_rate": 1.0,
        "min_length": 0, "max_length": 0
    }
    print("Test actor_id (should be unique/not_null):")
    print(model.predict(test_actor_id))
    
    # Real profile: first_name
    test_first_name = {
        "table_name": "actor", "column_name": "first_name", "data_type": "text",
        "total_rows": 200, "null_rate": 0.0, "distinct_rate": 0.64,
        "min_length": 2, "max_length": 11
    }
    print("\nTest first_name (should be not_null):")
    print(model.predict(test_first_name))
    
    # Real profile: address2 (messy)
    test_address2 = {
        "table_name": "address", "column_name": "address2", "data_type": "text",
        "total_rows": 603, "null_rate": 0.006, "distinct_rate": 0.001,
        "min_length": 0, "max_length": 0
    }
    print("\nTest address2 (should fall back to Agent):")
    print(model.predict(test_address2))
