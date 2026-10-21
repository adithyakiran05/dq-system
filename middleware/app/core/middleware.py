import time
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.security import resolve_tenant_and_user

logger = logging.getLogger("middleware.ingress")

class StandaloneGatewayMiddleware(BaseHTTPMiddleware):
    """
    Core Gateway Middleware that sits at the ingress of the Standalone Middleware.
    Responsibilities:
    1. Intercepts incoming requests.
    2. Resolves tenant context (tenant_id) and user context.
    3. Profiles response latency.
    4. Attaches security and tenant headers to outgoing responses.
    """
    async def dispatch(self, request: Request, call_next):
        # Allow CORS preflight requests to pass directly to CORSMiddleware
        if request.method == "OPTIONS":
            return await call_next(request)

        start_time = time.time()
        
        # 1. Resolve security & tenant
        try:
            tenant_id, user_id = resolve_tenant_and_user(request)
            request.state.tenant_id = tenant_id
            request.state.user_id = user_id
        except Exception as auth_err:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=getattr(auth_err, "status_code", 401),
                content={"status": "error", "message": getattr(auth_err, "detail", "Unauthorized")}
            )

        # 2. Proceed to route handler
        response: Response = await call_next(request)

        # 3. Calculate latency and attach custom metadata headers
        duration = time.time() - start_time
        response.headers["X-Process-Time"] = f"{duration:.4f}s"
        response.headers["X-Tenant-ID"] = request.state.tenant_id
        response.headers["X-Gateway"] = "DQ-Standalone-Middleware-v1"

        logger.info(
            f"[{request.method}] {request.url.path} "
            f"Tenant:{request.state.tenant_id} -> {response.status_code} in {duration:.4f}s"
        )
        return response
