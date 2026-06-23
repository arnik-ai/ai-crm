"""نقطه‌ی ورود FastAPI — ثبت Routerها، Middleware و Exception handlerها."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.shared.config.settings import get_settings
from src.shared.errors.exceptions import AppError

# Routerهای ماژول‌ها
from src.modules.identity.api.routes import router as auth_router
from src.modules.crm.api.routes import router as crm_router
from src.modules.telephony.api.routes import router as telephony_router
from src.modules.telephony.api.webhook import router as webhook_router
from src.modules.ai_analysis.api.routes import router as ai_router
from src.modules.analytics.api.routes import router as dashboard_router
from src.modules.assistant.api.routes import router as assistant_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # نقطه‌ی راه‌اندازی/خاموشی منابع (Redis pool, ...) در صورت نیاز
    yield


app = FastAPI(
    title="AI CRM — Educational Institutes",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code},
    )


@app.get("/healthz", tags=["system"])
async def healthz() -> dict:
    # liveness ساده: خودِ پروسه زنده است (بدون بررسی منابع بیرونی)
    return {"status": "ok"}


@app.get("/readyz", tags=["system"])
async def readyz() -> JSONResponse:
    """readiness واقعی: اتصال دیتابیس و Redis را بررسی می‌کند.

    اگر هرکدام قطع باشند، کد ۵۰۳ برمی‌گرداند تا پلتفرم (پارس‌پک) بفهمد سرویس
    آماده نیست و در صورت نیاز آن را restart/کنار بگذارد — به‌جای هنگِ خاموش.
    """
    from sqlalchemy import text

    from src.shared.db.base import SessionLocal
    from src.shared.db.redis_client import redis_client

    checks = {"db": False, "redis": False}
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
        checks["db"] = True
    except Exception:
        pass
    try:
        await redis_client.ping()
        checks["redis"] = True
    except Exception:
        pass

    ok = all(checks.values())
    return JSONResponse(
        status_code=200 if ok else 503,
        content={"status": "ready" if ok else "degraded", "checks": checks},
    )


API = "/api/v1"
app.include_router(auth_router, prefix=f"{API}/auth", tags=["auth"])
app.include_router(crm_router, prefix=f"{API}", tags=["crm"])
app.include_router(telephony_router, prefix=f"{API}/calls", tags=["calls"])
app.include_router(webhook_router, prefix=f"{API}/webhooks", tags=["webhooks"])
app.include_router(ai_router, prefix=f"{API}/ai", tags=["ai"])
app.include_router(dashboard_router, prefix=f"{API}/dashboard", tags=["dashboard"])
app.include_router(assistant_router, prefix=f"{API}/ai/assistant", tags=["assistant"])
