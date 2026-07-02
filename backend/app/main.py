"""نقطه‌ی ورود FastAPI — ثبت Routerها، Middleware و Exception handlerها."""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from src.shared.config.settings import get_settings
from src.shared.errors.exceptions import AppError

# Routerهای ماژول‌ها
from src.modules.identity.api.routes import router as auth_router
from src.modules.identity.api.users_routes import router as users_router
from src.modules.crm.api.routes import router as crm_router
from src.modules.telephony.api.routes import router as telephony_router
from src.modules.telephony.api.webhook import router as webhook_router
from src.modules.ai_analysis.api.routes import router as ai_router
from src.modules.analytics.api.routes import router as dashboard_router
from src.modules.assistant.api.routes import router as assistant_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # اتوماسیونِ اختیاریِ باشگاه مشتریان: حلقه‌ی خودکارِ امتیازدهی (scan) هر چند دقیقه.
    # گارد + try/except: خاموش/حذف‌شدنِ ماژول، اپ را نمی‌شکند. (docs/12-LOYALTY-CLUB.md)
    bg_tasks: list = []
    if settings.loyalty_enabled:
        try:
            from src.modules.loyalty.application.scheduler import scan_loop
            bg_tasks.append(asyncio.create_task(scan_loop()))
        except Exception:  # noqa: BLE001 — ماژولِ loyalty اختیاری است
            pass
    yield
    for t in bg_tasks:
        t.cancel()


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

# فشرده‌سازی پاسخ‌های بزرگ (JSON/CSV) برای سرعت بیشتر و مصرف پهنای‌باند کمتر.
app.add_middleware(GZipMiddleware, minimum_size=1024)


# محدودیت نرخ عمومی بر اساس IP و مسیر (جلوگیری از سوءاستفاده/بار ناگهانی).
# معافیت‌ها: health check و webhookها (که احراز هویت مستقل دارند و ممکن است
# انفجار رویداد داشته باشند). در نبودِ Redis، بی‌سروصدا اجازه‌ی عبور می‌دهد.
_RL_EXEMPT_PREFIXES = ("/healthz", "/readyz", "/api/v1/webhooks")


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    path = request.url.path
    if request.method != "OPTIONS" and not path.startswith(_RL_EXEMPT_PREFIXES):
        from src.shared.security.rate_limit import RateLimitError, enforce_rate_limit

        client_ip = request.client.host if request.client else "unknown"
        try:
            await enforce_rate_limit(
                f"{client_ip}:{path}", settings.rate_limit_default
            )
        except RateLimitError:
            return JSONResponse(
                status_code=429,
                content={"detail": "تعداد درخواست‌ها از حد مجاز گذشت",
                         "code": "RATE_LIMITED"},
            )
        except Exception:
            pass  # Redis در دسترس نیست → اجازه‌ی عبور (degrade graceful)
    return await call_next(request)


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
app.include_router(users_router, prefix=f"{API}/users", tags=["users"])
app.include_router(crm_router, prefix=f"{API}", tags=["crm"])
app.include_router(telephony_router, prefix=f"{API}/calls", tags=["calls"])
app.include_router(webhook_router, prefix=f"{API}/webhooks", tags=["webhooks"])
app.include_router(ai_router, prefix=f"{API}/ai", tags=["ai"])
app.include_router(dashboard_router, prefix=f"{API}/dashboard", tags=["dashboard"])
app.include_router(assistant_router, prefix=f"{API}/ai/assistant", tags=["assistant"])

# ماژولِ اختیاری و حذف‌شدنیِ «باشگاه مشتریان» (Loyalty).
# فقط اگر LOYALTY_ENABLED=true باشد ثبت می‌شود. try/except: اگر پوشه‌ی
# modules/loyalty/ حذف شود، این بلاک بی‌صدا رد می‌شود و بقیه‌ی برنامه سالم می‌ماند.
# (جزئیاتِ نصب/حذف: docs/12-LOYALTY-CLUB.md)
if settings.loyalty_enabled:
    try:
        from src.modules.loyalty.api.routes import router as loyalty_router
        app.include_router(loyalty_router, prefix=f"{API}/loyalty", tags=["loyalty"])
    except Exception:  # noqa: BLE001 — ماژولِ loyalty اختیاری است
        pass
