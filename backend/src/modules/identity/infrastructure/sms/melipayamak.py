"""Provider واقعی ملی‌پیامک (Melipayamak).

دو حالت پشتیبانی می‌شود:
1) وب‌سرویس الگوی OTP (توصیه‌شده): اگر otp_pattern تنظیم شده باشد، از endpoint
   ارسال با الگو استفاده می‌شود (سریع‌تر تأیید و مناسب کد یک‌بارمصرف).
2) ارسال ساده‌ی پیامک: در غیر این صورت، متن کامل از شماره‌ی from ارسال می‌شود.

مستندات: https://www.melipayamak.com  (REST API)
"""
import httpx

from src.modules.identity.application.ports import SmsProvider

_BASE = "https://rest.payamak-panel.com/api/SendSMS"


class MelipayamakSmsProvider(SmsProvider):
    def __init__(self, username: str, password: str, sender: str = "",
                 otp_pattern: str = "", timeout: int = 15):
        self._username = username
        self._password = password
        self._from = sender
        self._pattern = otp_pattern
        self._timeout = timeout

    async def send_otp(self, mobile: str, code: str) -> None:
        if self._pattern:
            await self._send_by_pattern(mobile, code)
        else:
            await self._send_plain(mobile, f"کد ورود شما: {code}")

    async def send_text(self, mobile: str, text: str) -> None:
        """ارسالِ واقعیِ پیامکِ متنِ آزاد (غیر OTP) از طریق وب‌سرویس SendSMS.

        برخلاف OTP، اینجا از الگو استفاده نمی‌شود؛ متن همان‌طور که هست با
        شماره‌ی from ارسال می‌شود. در صورت خطا، استثنا پرتاب می‌شود تا لایه‌ی
        بالا (MessagingService) بتواند status=failed ثبت کند.
        """
        await self._send_plain(mobile, text)

    async def _send_by_pattern(self, mobile: str, code: str) -> None:
        """ارسال با الگوی تأییدشده (BaseServiceNumber)."""
        payload = {
            "username": self._username,
            "password": self._password,
            "to": mobile,
            "bodyId": self._pattern,
            "text": code,  # مقدارِ جایگزینِ {0} در الگو
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(f"{_BASE}/BaseServiceNumber", data=payload)
            resp.raise_for_status()

    async def _send_plain(self, mobile: str, text: str) -> None:
        """ارسال پیامکِ متنِ کامل از شماره‌ی from (مشترک بین OTP ساده و متن آزاد)."""
        payload = {
            "username": self._username,
            "password": self._password,
            "to": mobile,
            "from": self._from,
            "text": text,
        }
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(f"{_BASE}/SendSMS", data=payload)
            resp.raise_for_status()
