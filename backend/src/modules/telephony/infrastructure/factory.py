"""Factory برای انتخاب TelephonyProvider بر اساس پیکربندی — Open/Closed."""
from src.modules.telephony.application.ports import TelephonyProvider
from src.modules.telephony.infrastructure.workano.provider import WorkanoProvider
from src.shared.config.settings import get_settings


def get_telephony_provider() -> TelephonyProvider:
    s = get_settings()
    if s.telephony_provider == "workano":
        return WorkanoProvider(
            webhook_secret=s.workano_webhook_secret,
            api_base=s.workano_api_base,
            api_key=s.workano_api_key,
        )
    # افزودن Provider جدید:
    # if s.telephony_provider == "asterisk":
    #     return AsteriskProvider(...)
    raise ValueError(f"Provider تلفنی پشتیبانی‌نشده: {s.telephony_provider}")
