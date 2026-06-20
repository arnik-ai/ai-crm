"""Router دستیار چت CRM."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.modules.identity.api.dependencies import require_permission

router = APIRouter()


class AssistantQuery(BaseModel):
    message: str


@router.post("/query")
async def query(
    body: AssistantQuery, user=Depends(require_permission("assistant:read"))
) -> dict:
    from src.modules.assistant.application.assistant_service import AssistantService
    return await AssistantService().answer(body.message, tenant_id=user.tenant_id,
                                           agent_id=user.id)
