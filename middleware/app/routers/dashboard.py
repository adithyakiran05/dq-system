from fastapi import APIRouter, Request
from app.services.dashboard_service import dashboard_service
from app.models.schemas import StandardResponse
import logging

logger = logging.getLogger("middleware.router.dashboard")
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/metrics", response_model=StandardResponse)
def get_dashboard_metrics(request: Request):
    tenant_id = getattr(request.state, "tenant_id", "default")
    try:
        data = dashboard_service.get_metrics(tenant_id=tenant_id)
        return StandardResponse(status="success", data=data)
    except Exception as e:
        logger.warning(f"Could not reach RDS database for metrics: {e}")
        return StandardResponse(
            status="db_offline",
            message=f"AWS RDS Database unreachable: {str(e)}. Please check your RDS Security Group inbound rules for Port 5432.",
            data={
                "activeRules": 0,
                "totalAnomalies": 0,
                "tablesMonitored": 0,
                "healthScore": 100
            }
        )

@router.get("/tables", response_model=StandardResponse)
def get_dashboard_tables(request: Request):
    tenant_id = getattr(request.state, "tenant_id", "default")
    try:
        data = dashboard_service.get_tables(tenant_id=tenant_id)
        return StandardResponse(status="success", data=data)
    except Exception as e:
        logger.warning(f"Could not reach RDS database for tables: {e}")
        return StandardResponse(
            status="db_offline",
            message=f"AWS RDS Database unreachable: {str(e)}",
            data=[]
        )
