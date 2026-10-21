import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Automatically look for .env in current dir, or fallback to frontend/.env.local or root .env
current_dir = Path(__file__).resolve().parent.parent
env_candidates = [
    current_dir / ".env",
    current_dir.parent / ".env",
    current_dir.parent / "frontend" / ".env.local",
    current_dir.parent / "dqagent" / ".env"
]

for env_path in env_candidates:
    if env_path.exists():
        load_dotenv(env_path, override=False)

class Settings(BaseSettings):
    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]
    
    # PostgreSQL RDS Connection
    DB_HOST: str = os.getenv("DB_HOST", "dq-database.c8bw22guwzeh.us-east-1.rds.amazonaws.com")
    DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
    DB_NAME: str = os.getenv("DB_NAME", "postgres")
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "YourPassword123!")
    
    # AWS Services Configuration
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "dq-custom-configs-bucket-1696417599")
    LAMBDA_PROFILER_NAME: str = os.getenv("LAMBDA_PROFILER_NAME", "lambda-profiler")
    LAMBDA_CHECKER_NAME: str = os.getenv("LAMBDA_CHECKER_NAME", "lambda-checker")
    LAMBDA_AGENT_TRIGGER_NAME: str = os.getenv("LAMBDA_AGENT_TRIGGER_NAME", "lambda-orchestrator-trigger")
    AGENT_TRIGGER_API_URL: str = os.getenv("NEXT_PUBLIC_TRIGGER_API_URL", "https://5hw2dmjup9.execute-api.us-east-1.amazonaws.com/orchestrator")
    
    # Security / Multi-Tenancy
    REQUIRE_AUTH: bool = os.getenv("REQUIRE_AUTH", "false").lower() in ("true", "1")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-dq-key")
    DEFAULT_TENANT_ID: str = os.getenv("DEFAULT_TENANT_ID", "default")

settings = Settings()
