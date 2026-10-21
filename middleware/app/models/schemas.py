from typing import Any, Optional, Union
from pydantic import BaseModel, Field

# ----------------- Rules Schemas -----------------
class RuleApproveRequest(BaseModel):
    rule_id: int

class RuleApproveAllRequest(BaseModel):
    rule_ids: list[int]

class RuleRejectRequest(BaseModel):
    rule_id: int

class RuleRejectAllRequest(BaseModel):
    rule_ids: list[int]

class RuleUpdateRequest(BaseModel):
    rule_id: int
    rule_config: Union[dict[str, Any], str]

# ----------------- Config Schemas -----------------
class ConfigSaveRequest(BaseModel):
    config_text: str

class ConfigDeleteRequest(BaseModel):
    config_id: int

class PresignedUrlRequest(BaseModel):
    filename: Optional[str] = None
    contentType: Optional[str] = "application/pdf"

# ----------------- Database Insert Schemas -----------------
class DatabaseInsertRequest(BaseModel):
    tableName: str
    payload: dict[str, Any]

# ----------------- Generic Responses -----------------
class StandardResponse(BaseModel):
    status: str = "success"
    message: Optional[str] = None
    data: Optional[Any] = None

class ErrorResponse(BaseModel):
    status: str = "error"
    message: str
    detail: Optional[str] = None
