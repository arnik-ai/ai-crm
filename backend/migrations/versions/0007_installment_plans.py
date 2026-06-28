"""پلنِ اقساطِ برنامه — جدول installment_plans (افزودنِ دستی مثل شیت اکسل)

هر ردیف: دانش‌آموز، مشاور، مبلغ کل، تعداد اقساط، مبلغ قسط، ماه شروع،
و paid (آرایه‌ی شماره‌اقساطِ پرداخت‌شده، JSONB).

idempotent است (IF NOT EXISTS) تا با schema.sql هم‌خوان بماند.

Revision ID: 0007_installments
Revises: 0006_sale_items
Create Date: 2026-06-29
"""
from alembic import op

revision = "0007_installments"
down_revision = "0006_sale_items"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS installment_plans (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id          uuid,
            student_name       text,
            mobile             text,
            advisor            text,
            amount             numeric(14,0) NOT NULL DEFAULT 0,
            count              int NOT NULL DEFAULT 1,
            installment_amount numeric(14,0) NOT NULL DEFAULT 0,
            start_month        text,
            paid               jsonb,
            note               text,
            created_at         timestamptz NOT NULL DEFAULT now(),
            updated_at         timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_installments_mobile ON installment_plans(mobile)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS installment_plans CASCADE")
