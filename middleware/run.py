import os
import sys
import uvicorn
from pathlib import Path

# Ensure middleware directory is on Python path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.config import settings

if __name__ == "__main__":
    print(f"Starting Standalone Middleware on http://{settings.HOST}:{settings.PORT}")
    print(f"Interactive API Docs available at http://localhost:{settings.PORT}/docs")
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
