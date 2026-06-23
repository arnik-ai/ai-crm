"""کش ساده‌ی JSON روی Redis برای کوئری‌های خواندنیِ سنگین (داشبورد/گزارش).

طراحی برای پایداری: اگر Redis در دسترس نباشد یا خطا بدهد، به‌جای شکست،
نتیجه را مستقیم از تابع تولیدکننده برمی‌گرداند (degrade graceful). یعنی کش
یک «بهینه‌سازی» است، نه یک «وابستگی سخت».
"""
import json
from collections.abc import Awaitable, Callable
from typing import Any

from src.shared.db.redis_client import redis_client


async def cached_json(
    key: str,
    ttl: int,
    producer: Callable[[], Awaitable[Any]],
) -> Any:
    """مقدار را از کش می‌خواند؛ اگر نبود، تولید و کش می‌کند.

    - key: کلید یکتا (مثلاً "dash:summary:<tenant>").
    - ttl: عمر کش بر حسب ثانیه.
    - producer: تابع async که در نبودِ کش، داده را تولید می‌کند.
    """
    # تلاش برای خواندن از کش (در صورت خطای Redis، بی‌سروصدا رد می‌شویم)
    try:
        hit = await redis_client.get(key)
        if hit is not None:
            return json.loads(hit)
    except Exception:
        pass

    data = await producer()

    # تلاش برای نوشتن در کش (خطای Redis نباید پاسخ را خراب کند)
    try:
        await redis_client.set(
            key, json.dumps(data, ensure_ascii=False, default=str), ex=ttl
        )
    except Exception:
        pass

    return data
