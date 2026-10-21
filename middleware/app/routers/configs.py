from fastapi import APIRouter, Request, HTTPException
from app.services.configs_service import configs_service
from app.services.aws_service import aws_service
from app.models.schemas import (
    StandardResponse,
    ConfigSaveRequest,
    ConfigDeleteRequest,
    PresignedUrlRequest
)
import logging

logger = logging.getLogger("middleware.router.configs")
router = APIRouter(prefix="/configs", tags=["Configurations"])

@router.get("", response_model=StandardResponse)
def list_configs(request: Request):
    tenant_id = getattr(request.state, "tenant_id", "default")
    try:
        configs = configs_service.list_configs(tenant_id=tenant_id)
        return StandardResponse(status="success", data=configs)
    except Exception as e:
        logger.warning(f"Could not reach RDS database for configs: {e}")
        return StandardResponse(
            status="db_offline",
            message=f"AWS RDS Database unreachable: {str(e)}",
            data=[]
        )

@router.post("", response_model=StandardResponse)
def save_config(body: ConfigSaveRequest, request: Request):
    try:
        tenant_id = getattr(request.state, "tenant_id", "default")
        config_id = configs_service.save_config(body.config_text, tenant_id=tenant_id)
        return StandardResponse(status="success", message="Configuration saved", data={"id": config_id})
    except Exception as e:
        return StandardResponse(status="error", message=str(e))

@router.delete("/{config_id}", response_model=StandardResponse)
def delete_config_by_id(config_id: int, request: Request):
    try:
        tenant_id = getattr(request.state, "tenant_id", "default")
        configs_service.delete_config(config_id, tenant_id=tenant_id)
        return StandardResponse(status="success", message="Configuration deleted")
    except Exception as e:
        return StandardResponse(status="error", message=str(e))

@router.post("/delete", response_model=StandardResponse)
def delete_config_post(body: ConfigDeleteRequest, request: Request):
    try:
        tenant_id = getattr(request.state, "tenant_id", "default")
        configs_service.delete_config(body.config_id, tenant_id=tenant_id)
        return StandardResponse(status="success", message="Configuration deleted")
    except Exception as e:
        return StandardResponse(status="error", message=str(e))

@router.post("/presigned-url", response_model=StandardResponse)
def get_presigned_url(body: PresignedUrlRequest):
    try:
        result = aws_service.generate_presigned_upload_url(
            filename=body.filename,
            content_type=body.contentType
        )
        return StandardResponse(status="success", data=result)
    except Exception as e:
        return StandardResponse(status="error", message=str(e))
