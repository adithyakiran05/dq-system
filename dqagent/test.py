import os
# set db env vars and groq env var
from dotenv import load_dotenv
load_dotenv()

import asyncio
from agent import generate_rules

async def run_test():
    res = await generate_rules()
    print("Agent /invoke response:", res)
    print("Waiting for background threads to complete...")

if __name__ == "__main__":
    asyncio.run(run_test())
