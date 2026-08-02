import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import pickle
import os

MODEL_PATH = "/tmp/dq_rf_model.pkl"
ENCODER_PATH = "/tmp/dq_type_encoder.pkl"

class DQMachineLearningModel:
    def __init__(self, confidence_threshold=0.80):
        self.confidence_threshold = confidence_threshold
        self.model = None
        self.type_encoder = None
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
        
        # Categorize data type manually for simplicity if we don't have the encoder,
        # otherwise use the trained encoder.
        if self.type_encoder:
            try:
                dt_encoded = self.type_encoder.transform([data_type])[0]
            except:
                dt_encoded = -1 # Unknown type
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
            return [] # No model trained yet
            
        features = [self._extract_features(profile)]
        
        # Get class probabilities
        probs = self.model.predict_proba(features)[0]
        classes = self.model.classes_
        
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
                    
                    # Add specific configs based on rule
                    if predicted_rule == "length":
                        rule["rule_config"] = {"length": profile.get('min_length')}
                    elif predicted_rule == "accepted_values" and "bool" in str(profile.get("data_type")):
                        rule["rule_config"] = {"values": ["true", "false"]}
                        
                    rules.append(rule)
                    
        return rules

    def load_model(self):
        if os.path.exists(MODEL_PATH) and os.path.exists(ENCODER_PATH):
            with open(MODEL_PATH, 'rb') as f:
                self.model = pickle.load(f)
            with open(ENCODER_PATH, 'rb') as f:
                self.type_encoder = pickle.load(f)
            return True
        return False
        
    def train(self, df):
        """
        Trains the model based on a pandas DataFrame of historical agent data.
        df should have columns:
        total_rows, null_rate, distinct_rate, min_length, max_length, data_type, target_rule_type
        """
        # Encode data type
        self.type_encoder = LabelEncoder()
        df['data_type_encoded'] = self.type_encoder.fit_transform(df['data_type'])
        
        # Feature engineering
        df['length_ratio'] = np.where(df['max_length'] > 0, df['min_length'] / df['max_length'], 0.0)
        df['is_fixed_length'] = np.where((df['min_length'] == df['max_length']) & (df['max_length'] > 0), 1.0, 0.0)
        
        features = ['total_rows', 'null_rate', 'distinct_rate', 'length_ratio', 'is_fixed_length', 'data_type_encoded']
        X = df[features].fillna(0)
        y = df['target_rule_type']
        
        self.model = RandomForestClassifier(n_estimators=50, random_state=42)
        self.model.fit(X, y)
        
        # Save model
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump(self.model, f)
        with open(ENCODER_PATH, 'wb') as f:
            pickle.dump(self.type_encoder, f)
            
        self.is_loaded = True
        return self.model
