from fastapi import APIRouter, Request, HTTPException
from app.services.database_service import database_service
from app.models.schemas import StandardResponse, DatabaseInsertRequest
import logging

logger = logging.getLogger("middleware.router.database")
router = APIRouter(prefix="/database", tags=["Database"])

@router.get("", response_model=StandardResponse)
@router.get("/profiles", response_model=StandardResponse)
def get_database_profiles(request: Request):
    tenant_id = getattr(request.state, "tenant_id", "default")
    try:
        data = database_service.get_profiles_grouped(tenant_id=tenant_id)
        return StandardResponse(status="success", data=data)
    except Exception as e:
        logger.warning(f"Could not reach RDS database for profiles: {e}")
        return StandardResponse(
            status="db_offline",
            message=f"AWS RDS Database unreachable: {str(e)}. Please check your RDS Security Group inbound rules for Port 5432.",
            data={}
        )

@router.post("/insert", response_model=StandardResponse)
def insert_record(body: DatabaseInsertRequest):
    try:
        new_row = database_service.insert_record(body.tableName, body.payload)
        return StandardResponse(
            status="success",
            message="Record inserted successfully",
            data=new_row
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.warning(f"Insert failed on RDS: {e}")
        return StandardResponse(
            status="error",
            message=f"Database insert failed: {str(e)}",
            data=None
        )
