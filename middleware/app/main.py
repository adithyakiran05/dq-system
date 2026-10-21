from contextlib import asynccontextmanager
import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.core.middleware import StandaloneGatewayMiddleware
from app.db.connection import db_pool
from app.routers import (
    dashboard,
    rules,
    configs,
    database,
    triggers
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-warm pooled RDS connections in a background thread so startup is non-blocking
    threading.Thread(target=db_pool.warmup, args=(3,), daemon=True).start()
    yield

app = FastAPI(
    title="Data Quality Standalone Middleware",
    description="Dedicated middle-tier service bridging Next.js frontend with AWS infrastructure & PostgreSQL RDS.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# 1. Standalone Ingress Gateway Middleware (Tenant extraction, timing, security headers)
app.add_middleware(StandaloneGatewayMiddleware)

# 2. CORS Middleware (Added LAST so it wraps outermost and catches all OPTIONS preflight requests immediately)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time", "X-Tenant-ID", "X-Gateway"]
)

# 3. Mount Routers under /api/v1
API_V1_PREFIX = "/api/v1"
app.include_router(dashboard.router, prefix=API_V1_PREFIX)
app.include_router(rules.router, prefix=API_V1_PREFIX)
app.include_router(configs.router, prefix=API_V1_PREFIX)
app.include_router(database.router, prefix=API_V1_PREFIX)
app.include_router(triggers.router, prefix=API_V1_PREFIX)

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "dq-standalone-middleware",
        "environment": settings.ENVIRONMENT,
        "region": settings.AWS_REGION
    }

@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "DQ System Standalone Middleware is running.",
        "documentation": "/docs",
        "health": "/health"
    }
