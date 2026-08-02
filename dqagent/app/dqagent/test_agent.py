import asyncio
from main import get_or_create_agent

async def run():
    agent = get_or_create_agent()
    print("Agent created. Invoking with prompt...")
    stream = agent.stream_async("Generate data quality rules for the staff table. It contains staff profile data.")
    async for event in stream:
        if "data" in event and isinstance(event["data"], str):
            print(event["data"], end="", flush=True)

if __name__ == "__main__":
    asyncio.run(run())
