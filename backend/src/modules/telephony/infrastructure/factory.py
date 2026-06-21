"""Factory برای انتخاب TelephonyProvider بر اساس پیکربندی — Open/Closed."""
from src.modules.telephony.application.ports import TelephonyProvider
from src.modules.telephony.infrastructure.simotel.provider import SimotelProvider
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
    if s.telephony_provider == "simotel":
        return SimotelProvider(
            webhook_token=s.simotel_webhook_token,
            api_base=s.simotel_api_base,
            api_token=s.simotel_api_token,
            webhook_secret=s.simotel_webhook_secret,
        )
    # افزودن Provider جدید:
    # if s.telephony_provider == "asterisk":
    #     return AsteriskProvider(...)
    raise ValueError(f"Provider تلفنی پشتیبانی‌نشده: {s.telephony_provider}")
