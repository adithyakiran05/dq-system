from fastapi import APIRouter, Request, HTTPException
from app.services.rules_service import rules_service
from app.models.schemas import (
    StandardResponse,
    RuleApproveRequest,
    RuleApproveAllRequest,
    RuleRejectRequest,
    RuleRejectAllRequest,
    RuleUpdateRequest
)
import logging

logger = logging.getLogger("middleware.router.rules")
router = APIRouter(prefix="/rules", tags=["Rules"])

@router.get("", response_model=StandardResponse)
def get_proposed_rules(request: Request):
    tenant_id = getattr(request.state, "tenant_id", "default")
    try:
        rules = rules_service.get_proposed_rules(tenant_id=tenant_id)
        return StandardResponse(status="success", data=rules)
    except Exception as e:
        logger.warning(f"Could not reach RDS database for rules: {e}")
        return StandardResponse(
            status="db_offline",
            message=f"AWS RDS Database unreachable: {str(e)}",
            data=[]
        )

@router.post("/approve", response_model=StandardResponse)
def approve_rule(body: RuleApproveRequest, request: Request):
    try:
        tenant_id = getattr(request.state, "tenant_id", "default")
        success = rules_service.approve_rule(body.rule_id, tenant_id=tenant_id)
        if not success:
            raise HTTPException(status_code=404, detail="Rule not found")
        return StandardResponse(status="success", message="Rule approved")
    except HTTPException:
        raise
    except Exception as e:
        return StandardResponse(status="error", message=str(e))

@router.post("/approve-all", response_model=StandardResponse)
def approve_all_rules(body: RuleApproveAllRequest, request: Request):
    try:
        tenant_id = getattr(request.state, "tenant_id", "default")
        count = rules_service.approve_all_rules(body.rule_ids, tenant_id=tenant_id)
        return StandardResponse(status="success", message=f"{count} rules approved")
    except Exception as e:
        return StandardResponse(status="error", message=str(e))

@router.post("/reject", response_model=StandardResponse)
def reject_rule(body: RuleRejectRequest, request: Request):
    try:
        tenant_id = getattr(request.state, "tenant_id", "default")
        rules_service.reject_rule(body.rule_id, tenant_id=tenant_id)
        return StandardResponse(status="success", message="Rule rejected")
    except Exception as e:
        return StandardResponse(status="error", message=str(e))

@router.post("/reject-all", response_model=StandardResponse)
def reject_all_rules(body: RuleRejectAllRequest, request: Request):
    try:
        tenant_id = getattr(request.state, "tenant_id", "default")
        count = rules_service.reject_all_rules(body.rule_ids, tenant_id=tenant_id)
        return StandardResponse(status="success", message=f"{count} rules rejected")
    except Exception as e:
        return StandardResponse(status="error", message=str(e))

@router.post("/update", response_model=StandardResponse)
def update_rule(body: RuleUpdateRequest, request: Request):
    try:
        tenant_id = getattr(request.state, "tenant_id", "default")
        rules_service.update_rule(body.rule_id, body.rule_config, tenant_id=tenant_id)
        return StandardResponse(status="success", message="Rule updated")
    except Exception as e:
        return StandardResponse(status="error", message=str(e))

@router.get("/summary", response_model=StandardResponse)
def get_rules_summary(request: Request):
    tenant_id = getattr(request.state, "tenant_id", "default")
    try:
        summary = rules_service.get_summary(tenant_id=tenant_id)
        return StandardResponse(status="success", data=summary)
    except Exception as e:
        logger.warning(f"Could not reach RDS database for rules summary: {e}")
        return StandardResponse(
            status="db_offline",
            message=f"AWS RDS Database unreachable: {str(e)}",
            data={"approvedCount": 0}
        )

@router.get("/history", response_model=StandardResponse)
def get_rules_history(request: Request):
    tenant_id = getattr(request.state, "tenant_id", "default")
    try:
        history = rules_service.get_history(tenant_id=tenant_id)
        return StandardResponse(status="success", data=history)
    except Exception as e:
        logger.warning(f"Could not reach RDS database for rules history: {e}")
        return StandardResponse(
            status="db_offline",
            message=f"AWS RDS Database unreachable: {str(e)}",
            data=[]
        )
