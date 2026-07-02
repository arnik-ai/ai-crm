"""افزودن «نتیجه‌ی آخرین تماس» (last_outcome) به students

برای نمایشِ نتیجه‌ی ثبت‌شده روی کارتِ «سرنخ‌های امروز» + علامتِ «اقدام‌شده».
`last_outcome` برچسبِ فارسیِ نتیجه (موفق/بی‌پاسخ/…) و `last_outcome_at` زمانِ ثبت است.

idempotent (IF NOT EXISTS) تا با schema.sql هم‌خوان بماند.

Revision ID: 0009_student_last_outcome
Revises: 0008_perf_indexes
Create Date: 2026-07-02
"""
from alembic import op

revision = "0009_student_last_outcome"
down_revision = "0008_perf_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS last_outcome text")
    op.execute(
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS last_outcome_at timestamptz"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS last_outcome_at")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS last_outcome")
