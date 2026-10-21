from typing import Optional
from fastapi import Request, HTTPException, status
import jwt
from app.config import settings

def resolve_tenant_and_user(request: Request) -> tuple[str, Optional[str]]:
    """
    Extracts the tenant_id and user_id from the incoming request.
    Priority:
    1. Authorization Bearer JWT (contains tenant_id and sub/user_id)
    2. X-Tenant-ID header
    3. Default tenant ID from settings
    """
    tenant_id = settings.DEFAULT_TENANT_ID
    user_id = None
    
    # 1. Check custom X-Tenant-ID header
    custom_tenant = request.headers.get("X-Tenant-ID")
    if custom_tenant:
        tenant_id = custom_tenant

    # 2. Check Authorization Bearer token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            # Decode token (in production verify signature with secret or public JWKS)
            payload = jwt.decode(token, options={"verify_signature": False})
            tenant_id = payload.get("tenant_id") or payload.get("custom:tenant_id") or tenant_id
            user_id = payload.get("sub") or payload.get("user_id")
        except Exception:
            if settings.REQUIRE_AUTH:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired authentication token"
                )
    elif settings.REQUIRE_AUTH:
        # If authentication is strictly required and no header provided:
        if request.url.path not in ["/health", "/", "/docs", "/openapi.json"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication credentials are required"
            )

    return tenant_id, user_id
