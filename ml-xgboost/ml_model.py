import pandas as pd
import numpy as np
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder
import pickle
import os

# Using /tmp for AWS Lambda compatibility when running there
BASE_DIR = '/tmp' if os.environ.get('AWS_EXECUTION_ENV') else '.'
MODEL_PATH = os.path.join(BASE_DIR, "dq_xgb_model.pkl")
ENCODER_PATH = os.path.join(BASE_DIR, "dq_type_encoder.pkl")
TARGET_ENCODER_PATH = os.path.join(BASE_DIR, "dq_target_encoder.pkl")

class DQMachineLearningModel:
    def __init__(self, confidence_threshold=0.80):
        self.confidence_threshold = confidence_threshold
        self.model = None
        self.type_encoder = None
        self.target_encoder = None
        self.is_loaded = self.load_model()
        
    def _extract_features(self, profile):
        """Converts a profile dict into a numeric feature array for prediction."""
        total_rows = int(profile.get('total_rows', 0))
        null_rate = float(profile.get('null_rate') or 0.0)
        distinct_rate = float(profile.get('distinct_rate') or 0.0)
        
        min_length = profile.get('min_length')
        max_length = profile.get('max_length')
        
        if min_length is not None and max_length is not None and max_length > 0:
            length_ratio = float(min_length) / float(max_length)
            is_fixed_length = 1.0 if min_length == max_length else 0.0
        else:
            length_ratio = 0.0
            is_fixed_length = 0.0
            
        data_type = str(profile.get('data_type', 'unknown')).lower()
        
        if self.type_encoder:
            try:
                dt_encoded = self.type_encoder.transform([data_type])[0]
            except:
                dt_encoded = -1
        else:
            dt_encoded = 0
            
        return [
            total_rows,
            null_rate,
            distinct_rate,
            length_ratio,
            is_fixed_length,
            dt_encoded
        ]

    def predict(self, profile):
        if not self.is_loaded:
            return []
            
        features = [self._extract_features(profile)]
        
        # XGBClassifier expects a 2D array or dataframe.
        # features is already a 2D list.
        probs = self.model.predict_proba(features)[0]
        classes = self.target_encoder.classes_
        
        rules = []
        for idx, prob in enumerate(probs):
            if prob >= self.confidence_threshold:
                predicted_rule = classes[idx]
                if predicted_rule != "none":
                    rule = {
                        "table_name": profile.get("table_name"),
                        "column_name": profile.get("column_name"),
                        "rule_type": predicted_rule,
                        "severity": "high" if prob > 0.9 else "medium",
                        "confidence": float(prob),
                        "rule_config": {}
                    }
                    
                    if predicted_rule == "length":
                        rule["rule_config"] = {"length": profile.get('min_length')}
                    elif predicted_rule == "accepted_values" and "bool" in str(profile.get("data_type")):
                        rule["rule_config"] = {"values": ["true", "false"]}
                        
                    rules.append(rule)
                    
        return rules

    def load_model(self):
        if os.path.exists(MODEL_PATH) and os.path.exists(ENCODER_PATH) and os.path.exists(TARGET_ENCODER_PATH):
            with open(MODEL_PATH, 'rb') as f:
                self.model = pickle.load(f)
            with open(ENCODER_PATH, 'rb') as f:
                self.type_encoder = pickle.load(f)
            with open(TARGET_ENCODER_PATH, 'rb') as f:
                self.target_encoder = pickle.load(f)
            return True
        return False
        
    def train(self, df):
        self.type_encoder = LabelEncoder()
        df['data_type_encoded'] = self.type_encoder.fit_transform(df['data_type'])
        
        df['length_ratio'] = np.where(df['max_length'] > 0, df['min_length'] / df['max_length'], 0.0)
        df['is_fixed_length'] = np.where((df['min_length'] == df['max_length']) & (df['max_length'] > 0), 1.0, 0.0)
        
        features = ['total_rows', 'null_rate', 'distinct_rate', 'length_ratio', 'is_fixed_length', 'data_type_encoded']
        X = df[features].fillna(0)
        y = df['target_rule_type']
        
        self.target_encoder = LabelEncoder()
        y_encoded = self.target_encoder.fit_transform(y)
        
        self.model = XGBClassifier(n_estimators=50, random_state=42)
        self.model.fit(X, y_encoded)
        
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump(self.model, f)
        with open(ENCODER_PATH, 'wb') as f:
            pickle.dump(self.type_encoder, f)
        with open(TARGET_ENCODER_PATH, 'wb') as f:
            pickle.dump(self.target_encoder, f)
            
        self.is_loaded = True
        return self.model
