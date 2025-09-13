from pydantic import BaseModel, Field
from typing import Dict, Any, List

class PlanItem(BaseModel):
    name: str = Field(..., description="Action name")
    params: Dict[str, Any] = Field(default_factory=dict)

class PlanResponse(BaseModel):
    actions: List[PlanItem]
    meta: Dict[str, Any] | None = None

class PromptRequest(BaseModel):
    prompt: str
