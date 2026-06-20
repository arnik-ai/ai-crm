"""پیکربندی مشترک تست — تنظیم متغیرهای محیطی پیش‌فرض برای import امن ماژول‌ها."""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("DATABASE_URL",
                      "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("WORKANO_WEBHOOK_SECRET", "test-webhook-secret")
