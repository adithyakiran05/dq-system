import os
import json
import uvicorn
import time
from fastapi import FastAPI, Request, BackgroundTasks
from groq import Groq
import httpx
import mcp_server

app = FastAPI(title="DQ Agent Runtime")

@app.get("/ping")
async def ping():
    return {"status": "ok"}

def process_profiles_background(profiles_list, system_prompt):
    http_client = httpx.Client(verify=False)
    client = Groq(api_key=os.environ.get("GROQ_API_KEY"), http_client=http_client)
    
    # Batch the profiles into chunks of 7 to speed up processing
    chunk_size = 7
    batches = [profiles_list[i:i + chunk_size] for i in range(0, len(profiles_list), chunk_size)]
    
    for batch in batches:
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(batch)}
                ],
                model="llama-3.1-8b-instant",
                temperature=0.1,
            )
            
            generated_rules_json = chat_completion.choices[0].message.content
            
            # Clean up any potential markdown formatting the LLM might add
            if generated_rules_json.startswith("```"):
                generated_rules_json = generated_rules_json.strip('`').replace('json\n', '').strip()
                
            try:
                raw_rules = json.loads(generated_rules_json)
                valid_rules = []
                
                for rule in raw_rules:
                    # Find the corresponding profile data to cross-check the LLM's logic
                    profile = next((p for p in batch if p['table_name'] == rule['table_name'] and p['column_name'] == rule['column_name']), None)
                    
                    if not profile:
                        continue
                        
                    rt = rule.get('rule_type')
                    
                    dt = profile.get('data_type', '').lower()
                    col_name = rule['column_name'].lower()
                    
                    # 1. Reject 'not_null' if the column is already > 5% null
                    if rt == 'not_null' and profile.get('null_rate', 0) > 0.05:
                        continue
                        
                    # 2. Reject 'unique' if the column is < 95% unique
                    if rt == 'unique' and profile.get('distinct_rate', 0) < 0.95:
                        continue
                        
                    # 3. If accepted_values, ensure the LLM didn't hallucinate random arrays
                    if rt == 'accepted_values':
                        config_vals = rule.get('rule_config', {}).get('values', [])
                        if config_vals == ["1", "2", "3", "4", "5"]:
                            continue
                        if 'char' in dt or 'text' in dt:
                            continue
                            
                    # 4. Reject 'unique' for dates/timestamps
                    if rt == 'unique' and ('date' in dt or 'time' in dt):
                        continue
                        
                    # 5. Handle phone numbers/emails dynamically via regex_match
                    if rt == 'regex_match':
                        if not rule.get('rule_config', {}).get('regex'):
                            continue
                        
                    valid_rules.append(rule)
                    
                # Save only the validated rules
                if valid_rules:
                    mcp_server.save_rules_bulk(json.dumps(valid_rules))
                    
            except json.JSONDecodeError:
                print("Failed to decode JSON from LLM")
            
        except Exception as e:
            print(f"Error processing batch: {e}")
            
        # Add a 1.5 second sleep as requested by the user
        time.sleep(1.5)


@app.post("/invocations")
async def generate_rules(background_tasks: BackgroundTasks):
    try:
        # 1. Fetch Profiles Natively
        profiles_json = mcp_server.get_profiles()
        all_profiles = json.loads(profiles_json)
        
        # Filter out DQ system tables
        ignore_tables = {"dq_rules", "dq_profiles", "dq_violations"}
        profiles_list = [p for p in all_profiles if p.get("table_name") not in ignore_tables]
        
        # 2. Prepare the Agent's System Prompt
        system_prompt = """
        You are an expert Data Quality Engineer. Analyze the database profiles and generate comprehensive data quality rules covering the 6 core dimensions of Data Quality: Completeness, Uniqueness, Validity, Accuracy, Consistency, and Timeliness.
        
        CRITICAL INSTRUCTIONS:
        1. ONLY use these rule_type values: "not_null", "unique", "min_value", "max_value", "accepted_values", "regex_match", "min_length", "max_length", "freshness".
        2. Do NOT generate a "unique" rule if the distinct_rate is less than 1.0.
        3. Do NOT generate a "not_null" rule if the null_rate is significantly greater than 0.
        4. "rule_config" formats:
           - min/max_value: {"min_value": X} or {"max_value": Y}
           - accepted_values: {"values": ["A", "B"]}
           - regex_match: {"regex": "^[a-z]+$"}
           - min/max_length: {"min_length": X}
           - freshness: {"max_days_old": X}
        5. The "dq_type" field MUST be one of the 6 core dimensions:
           - "Completeness" (for not_null)
           - "Uniqueness" (for unique)
           - "Validity" (for regex_match, accepted_values, lengths)
           - "Accuracy" (for min_value, max_value)
           - "Consistency" (if a column ends in _id and implies a relationship)
           - "Timeliness" (for freshness on updated_at/created_at timestamps)
        
        Return ONLY a raw JSON array matching this exact schema:
        [
          {
            "table_name": "string",
            "column_name": "string",
            "rule_type": "string",
            "severity": "string",
            "confidence": 0.9,
            "rule_config": {},
            "dq_type": "string"
          }
        ]
        Do not include any markdown formatting or explanations. Just the JSON array.
        """
        
        # 3. Offload the heavy generation loop to a Background Task to instantly return to AWS!
        background_tasks.add_task(process_profiles_background, profiles_list, system_prompt)
        
        return {
            "status": "success", 
            "message": f"Successfully started processing {len(profiles_list)} profiles in batches of 3 in the background! The agent is now generating rules and saving them to RDS."
        }
            
    except Exception as e:
        import traceback
        return {
            "status": "error", 
            "message": str(e),
            "traceback": traceback.format_exc()
        }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
