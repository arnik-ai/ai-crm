"""ساخت جدول sales (فیش فروش) — محصول، مدت برنامه، جزئیات واریز، موعد تمدید

idempotent است (IF NOT EXISTS) تا با schema.sql هم‌خوان بماند.

Revision ID: 0004_sales
Revises: 0003_user_mobile
Create Date: 2026-06-23
"""
from alembic import op

revision = "0004_sales"
down_revision = "0003_user_mobile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS sales (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id       uuid,
            student_id      uuid REFERENCES students(id) ON DELETE SET NULL,
            agent_id        uuid REFERENCES users(id) ON DELETE SET NULL,
            student_name    text,
            mobile          text,
            product         text NOT NULL,
            program_months  int,
            amount          numeric(14,0) NOT NULL DEFAULT 0,
            payment_method  text,
            payment_ref     text,
            note            text,
            sold_at         timestamptz NOT NULL DEFAULT now(),
            renewal_due_at  timestamptz,
            created_at      timestamptz NOT NULL DEFAULT now(),
            updated_at      timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_sold ON sales(sold_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_agent ON sales(agent_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_student ON sales(student_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sales_renewal ON sales(renewal_due_at) "
        "WHERE renewal_due_at IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS sales CASCADE")
