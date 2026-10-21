from fastapi import APIRouter, Request, HTTPException
from app.services.aws_service import aws_service
from app.config import settings
from app.models.schemas import StandardResponse

router = APIRouter(prefix="/triggers", tags=["Cloud Triggers"])

@router.post("/profiler", response_model=StandardResponse)
def trigger_profiler(request: Request):
    """
    Safely triggers the AWS Lambda Profiler via Boto3 (Event-driven).
    Replaces child_process shell execution.
    """
    try:
        tenant_id = getattr(request.state, "tenant_id", "default")
        res = aws_service.invoke_lambda_async(
            settings.LAMBDA_PROFILER_NAME,
            {"tenant_id": tenant_id, "action": "profile"}
        )
        return StandardResponse(status="success", message="Profiler started successfully", data=res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/checker", response_model=StandardResponse)
def trigger_checker(request: Request):
    """
    Safely triggers the AWS Lambda Checker via Boto3 (Event-driven).
    Replaces child_process shell execution.
    """
    try:
        tenant_id = getattr(request.state, "tenant_id", "default")
        res = aws_service.invoke_lambda_async(
            settings.LAMBDA_CHECKER_NAME,
            {"tenant_id": tenant_id, "action": "check"}
        )
        return StandardResponse(status="success", message="Checker started successfully", data=res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agent", response_model=StandardResponse)
async def trigger_agent(request: Request):
    """
    Triggers the DQ Agent / Bedrock runtime to generate rules.
    """
    try:
        tenant_id = getattr(request.state, "tenant_id", "default")
        res = await aws_service.trigger_agent(tenant_id)
        return StandardResponse(status="success", message="DQ Agent triggered successfully", data=res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
