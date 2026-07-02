"""زمان‌بندِ خودکارِ امتیازدهی (بدونِ Celery-beat) — حلقه‌ی سبکِ داخلِ api.

هدف: کارمند هیچ کاری نکند؛ سیستم هر چند دقیقه خودش فروش/تماس‌های جدید را امتیاز دهد.

⚠️ چون gunicorn چند worker دارد، با **قفلِ Redis** فقط یکی در هر تیک واقعاً scan می‌کند
(scan خودش idempotent است، ولی قفل از کارِ تکراری هم جلوگیری می‌کند). اگر Redis نبود،
بی‌سروصدا رد می‌شود. کاملاً داخلِ ماژولِ loyalty است → با حذفِ ماژول، این هم می‌رود.
"""
import asyncio

from src.shared.config.settings import get_settings
from src.shared.db.base import SessionLocal

_LOCK_KEY = "loyalty:scan:lock"


async def _run_once() -> None:
    from src.modules.loyalty.application.projection import Projection
    from src.shared.db.redis_client import redis_client

    settings = get_settings()
    # قفلِ کوتاه‌تر از interval تا فقط یک worker اجرا کند
    ttl = max(30, int(settings.loyalty_scan_interval) - 20)
    try:
        got = await redis_client.set(_LOCK_KEY, "1", nx=True, ex=ttl)
        if not got:
            return  # workerِ دیگری این تیک را برداشت
    except Exception:  # noqa: BLE001 — نبودِ Redis نباید حلقه را بشکند
        pass  # بدونِ قفل هم ادامه می‌دهیم (scan idempotent است)

    async with SessionLocal() as session:
        await Projection(session).scan()


async def scan_loop() -> None:
    """هر `loyalty_scan_interval` ثانیه یک‌بار scan را اجرا می‌کند (تا cancel شود)."""
    interval = int(get_settings().loyalty_scan_interval)
    while True:
        try:
            await asyncio.sleep(interval)
            await _run_once()
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 — هیچ خطایی نباید حلقه را متوقف کند
            pass
