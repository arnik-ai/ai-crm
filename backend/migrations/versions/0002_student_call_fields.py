"""افزودن فیلدهای گروه ۱: شهر، رشته، پایه، هدف به دانشجو + نتیجه‌ی تماس به Call

Revision ID: 0002_fields
Revises: 0001_initial
Create Date: 2026-06-22
"""
import sqlalchemy as sa

from alembic import op

revision = "0002_fields"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # دانشجو
    op.add_column("students", sa.Column("city", sa.Text(), nullable=True))
    op.add_column("students", sa.Column("field", sa.Text(), nullable=True))
    op.add_column("students", sa.Column("grade", sa.Text(), nullable=True))
    op.add_column("students", sa.Column("goal", sa.Text(), nullable=True))
    # تماس — نتیجه‌ی فروشِ دستی (جدا از status فنی)
    op.add_column("calls", sa.Column("outcome", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("calls", "outcome")
    op.drop_column("students", "goal")
    op.drop_column("students", "grade")
    op.drop_column("students", "field")
    op.drop_column("students", "city")
