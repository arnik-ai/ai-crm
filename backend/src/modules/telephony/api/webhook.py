"""Router دریافت Webhook تلفنی — پاسخ سریع، پردازش async.

هر دو endpoint (Workano و Simotel) از Provider فعالِ تنظیم‌شده در .env استفاده می‌کنند؛
بنابراین فقط endpointی فعال است که TELEPHONY_PROVIDER با آن هماهنگ باشد. منطق مشترک در
_receive متمرکز شده تا تکرار نشود (DRY).
"""
from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse

from src.modules.telephony.application.webhook_service import handle_webhook
from src.modules.telephony.infrastructure.factory import get_telephony_provider

router = APIRouter()


async def _receive(request: Request) -> JSONResponse:
    raw = await request.body()
    provider = get_telephony_provider()

    if not provider.verify_signature(raw, dict(request.headers)):
        return JSONResponse(
            status_code=401,
            content={"detail": "امضا/توکن نامعتبر", "code": "AUTH_INVALID"},
        )

    payload = await request.json()
    result = await handle_webhook(provider, payload)
    return JSONResponse(status_code=200, content=result)


@router.post("/workano", status_code=status.HTTP_200_OK)
async def workano_webhook(request: Request) -> JSONResponse:
    return await _receive(request)


@router.post("/simotel", status_code=status.HTTP_200_OK)
async def simotel_webhook(request: Request) -> JSONResponse:
    return await _receive(request)
