"""پیکربندی متمرکز برنامه — منطبق بر اصل 12-Factor (همه‌چیز از Environment)."""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Application
    app_env: str = "development"
    app_name: str = "ai-crm"
    secret_key: str = "change-me"
    cors_origins: str = "http://localhost:3000"

    # Database
    database_url: str = "postgresql+asyncpg://crm:crm@localhost:5432/crm"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # JWT
    jwt_algorithm: str = "HS256"
    jwt_access_ttl: int = 900
    jwt_refresh_ttl: int = 604800

    # S3
    s3_endpoint: str = ""
    s3_bucket: str = "crm-recordings"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_region: str = "us-east-1"

    # Telephony
    telephony_provider: str = "workano"
    workano_webhook_secret: str = ""
    workano_api_base: str = "https://pbx.workano.cloud/api"
    workano_api_key: str = ""
    workano_ip_allowlist: str = ""

    # AI
    ai_provider: str = "avalai"
    avalai_api_key: str = ""
    avalai_base_url: str = "https://api.avalai.ir/v1"
    avalai_llm_model: str = "gpt-5.5"
    avalai_stt_model: str = "whisper-1"
    ai_llm_timeout: int = 60
    ai_stt_timeout: int = 120

    # Rate limiting
    rate_limit_default: str = "100/minute"
    rate_limit_login: str = "5/minute"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
