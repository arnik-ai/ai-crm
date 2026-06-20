"""ساخت اولیه‌ی کل اسکیمای دیتابیس از روی sql/schema.sql

این migration تنها منبع حقیقتِ ساختار اولیه است: همان فایل DDL مستندشده را اجرا می‌کند
تا اسکیمای دیتابیس و مستندات هرگز از هم جدا نشوند.

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-21
"""
from pathlib import Path

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

# backend/migrations/versions/<this> → بالا تا backend/ سپس sql/schema.sql
_SCHEMA_PATH = Path(__file__).resolve().parents[2] / "sql" / "schema.sql"


def upgrade() -> None:
    sql = _SCHEMA_PATH.read_text(encoding="utf-8")
    op.execute(sql)


def downgrade() -> None:
    # حذف کامل اسکیما (ترتیب وابستگی‌ها با CASCADE رعایت می‌شود)
    op.execute(
        """
        DROP TABLE IF EXISTS audit_logs, webhook_logs, lead_scores, transcripts,
            recordings, calls, activities, followups, notes, student_tags, tags,
            students, sales_stages, courses, role_permissions, user_roles,
            permissions, roles, users, tenants CASCADE;
        """
    )
