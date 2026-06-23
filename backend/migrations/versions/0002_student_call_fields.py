"""افزودن فیلدهای گروه ۱: شهر، رشته، پایه، هدف به دانشجو + نتیجه‌ی تماس به Call

Revision ID: 0002_fields
Revises: 0001_initial
Create Date: 2026-06-22
"""
from alembic import op

revision = "0002_fields"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # idempotent: این ستون‌ها در schema.sql هم هستند؛ روی نصب تازه دوباره ساخته نمی‌شوند.
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS city text")
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS field text")
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS grade text")
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS goal text")
    op.execute("ALTER TABLE calls ADD COLUMN IF NOT EXISTS outcome text")


def downgrade() -> None:
    op.execute("ALTER TABLE calls DROP COLUMN IF EXISTS outcome")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS goal")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS grade")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS field")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS city")
