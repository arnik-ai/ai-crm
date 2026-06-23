"""افزودن ستون mobile به users برای ورود با پیامک (OTP)

idempotent است: چه دیتابیس از روی schema.sql (که mobile را دارد) ساخته شده باشد
و چه دیتابیس قدیمی، بدون خطا اجرا می‌شود.

Revision ID: 0003_user_mobile
Revises: 0002_fields
Create Date: 2026-06-23
"""
from alembic import op

revision = "0003_user_mobile"
down_revision = "0002_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile varchar(20)")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_mobile "
        "ON users(mobile) WHERE mobile IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_users_mobile")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS mobile")
