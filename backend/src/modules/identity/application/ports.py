"""Portهای ماژول هویت — اینترفیس‌های قابل‌تعویض (Provider Abstraction)."""
from abc import ABC, abstractmethod


class SmsProvider(ABC):
    """اینترفیس ارسال پیامک. پیاده‌سازی‌ها: Console (تست)، Melipayamak (واقعی)."""

    @abstractmethod
    async def send_otp(self, mobile: str, code: str) -> None:
        """کد یک‌بارمصرف را به شماره‌ی موبایل ارسال می‌کند.

        در صورت خطای ارسال باید استثنا پرتاب کند تا لایه‌ی بالا مدیریت کند.
        """

    @property
    def returns_debug_code(self) -> bool:
        """آیا این provider حالت تست است و کد را برای نمایش برمی‌گرداند؟

        فقط برای Console درست است؛ providerهای واقعی هرگز کد را فاش نمی‌کنند.
        """
        return False
