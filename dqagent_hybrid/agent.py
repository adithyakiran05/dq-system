import os
import json
import uvicorn
import time
from fastapi import FastAPI, Request, BackgroundTasks
from groq import Groq
import httpx
import mcp_server

app = FastAPI(title="DQ Hybrid Agent")

@app.get("/ping")
async def ping():
    return {"status": "ok"}

def process_profiles_background():
    try:
        print("Starting hybrid profile processing...")
        all_profiles = mcp_server.get_profiles()
        
        # We process all tables here (or you could filter)
        ignore_tables = ["spatial_ref_sys"]
        profiles_list = [p for p in all_profiles if p.get("table_name") not in ignore_tables]
        
        rule_engine = mcp_server.DQRuleEngine()
        
        engine_rules = []
        llm_queue = []
        
        # 1. Run deterministic rule engine
        for profile in profiles_list:
            deterministic_rules = rule_engine.evaluate(profile)
            if deterministic_rules:
                for r in deterministic_rules:
                    r["table_name"] = profile["table_name"]
                    r["column_name"] = profile["column_name"]
                    r["generated_by"] = "engine"
                    engine_rules.append(r)
            else:
                llm_queue.append(profile)
                
        # Save engine rules immediately
        if engine_rules:
            mcp_server.save_rules_bulk(engine_rules)
            print(f"Saved {len(engine_rules)} deterministic rules from engine.")

        # 2. Process remaining via LLM
        if not llm_queue:
            print("No profiles left for LLM.")
            return

        client = Groq(
            api_key=os.environ.get("GROQ_API_KEY"),
            http_client=httpx.Client(verify=False)
        )
        
        system_prompt = """
        You are an expert Data Quality Engineer. Analyze the database profiles and generate comprehensive data quality rules covering the 6 core dimensions of Data Quality: Completeness, Uniqueness, Validity, Accuracy, Consistency, and Timeliness.
        
        CRITICAL INSTRUCTIONS:
        1. ONLY use these rule_type values: "not_null", "unique", "min_value", "max_value", "accepted_values", "regex_match", "min_length", "max_length", "freshness".
        2. Do NOT generate a "unique" rule if the distinct_rate is less than 0.95 (columns with >= 95% uniqueness are likely meant to be unique IDs).
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
           
        CRITICAL: YOU MUST GENERATE RULES FOR ALL TYPES OF COLUMNS!
        - For NUMERIC columns (int, float, numeric), you MUST generate min_value or max_value rules if possible.
        - For STRING/TEXT columns (varchar, text), you MUST generate length checks (min_length, max_length) or regex_match.
        - You must analyze EVERY column in the batch. Do not skip any.
        
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
        
        chunk_size = 6
        batches = [llm_queue[i:i + chunk_size] for i in range(0, len(llm_queue), chunk_size)]
        
        print(f"Processing {len(llm_queue)} profiles in {len(batches)} batches via LLM.")
        
        final_llm_rules = []
        for i, batch in enumerate(batches):
            try:
                chat_completion = client.chat.completions.create(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": json.dumps(batch)}
                    ],
                    model="qwen/qwen3.8-27b",
                    temperature=0.1,
                )
                
                generated_rules_json = chat_completion.choices[0].message.content
                
                if generated_rules_json.startswith("```"):
                    generated_rules_json = generated_rules_json.strip('`').replace('json\n', '').strip()
                    
                try:
                    raw_rules = json.loads(generated_rules_json)
                    
                    for rule in raw_rules:
                        # Find the corresponding profile data
                        profile = next((p for p in batch if p['table_name'] == rule['table_name'] and p['column_name'] == rule['column_name']), None)
                        
                        if not profile:
                            continue
                            
                        r = rule.copy()
                        r["generated_by"] = "agent 2 llm"
                        final_llm_rules.append(r)
                        
                except json.JSONDecodeError:
                    print(f"Failed to parse JSON from LLM: {generated_rules_json}")
                    
                # Rate limiting delay
                time.sleep(2)
                
            except Exception as e:
                print(f"Error processing batch {i}: {e}")
                
        if final_llm_rules:
            mcp_server.save_rules_bulk(final_llm_rules)
            print(f"Saved {len(final_llm_rules)} rules from LLM.")
            
        print("Hybrid processing complete!")
            
    except Exception as e:
        import traceback
        print(f"Fatal error in background task: {e}")
        traceback.print_exc()

@app.post("/invocations")
async def invoke_agent(request: Request, background_tasks: BackgroundTasks):
    try:
        body = await request.json()
        action = body.get("action")
        
        if action == "generate_rules":
            background_tasks.add_task(process_profiles_background)
            return {"status": "processing_started", "message": "Hybrid rule generation started in background"}
            
        return {"status": "error", "message": "Unknown action"}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
