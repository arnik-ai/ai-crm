"""Router دریافت Webhook تلفنی — پاسخ سریع، پردازش async."""
from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from src.modules.telephony.application.webhook_service import handle_webhook
from src.modules.telephony.infrastructure.factory import get_telephony_provider

router = APIRouter()


@router.post("/workano", status_code=status.HTTP_200_OK)
async def workano_webhook(request: Request) -> JSONResponse:
    raw = await request.body()
    provider = get_telephony_provider()

    if not provider.verify_signature(raw, dict(request.headers)):
        return JSONResponse(status_code=401,
                            content={"detail": "امضای نامعتبر", "code": "AUTH_INVALID"})

    payload = await request.json()
    result = await handle_webhook(provider, payload)
    return JSONResponse(status_code=200, content=result)
