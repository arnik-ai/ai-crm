"""فیشِ چندمحصولی: جدول sale_items + اسناد واریز روی sales

«مبلغ جدا برای هر محصول» → جدول sale_items (هر محصول یک ردیف با مبلغ خودش).
اسناد واریز روی sales: deposited_at (ساعت+تاریخ)، payer_card (کارت واریزکننده)،
dest_account (بانک مقصد/حساب ما). نوع پرداخت دیگر استفاده نمی‌شود ولی ستونش
برای سازگاری می‌ماند.

idempotent است (IF NOT EXISTS) تا با schema.sql هم‌خوان بماند.

Revision ID: 0006_sale_items
Revises: 0005_gpa_messages
Create Date: 2026-06-25
"""
from alembic import op

revision = "0006_sale_items"
down_revision = "0005_gpa_messages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS deposited_at timestamptz")
    op.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS payer_card text")
    op.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS dest_account text")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS sale_items (
            id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            sale_id        uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
            product        text NOT NULL,
            program_months int,
            amount         numeric(14,0) NOT NULL DEFAULT 0,
            created_at     timestamptz NOT NULL DEFAULT now(),
            updated_at     timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_sale_items_sale ON sale_items(sale_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sale_items_product ON sale_items(product)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS sale_items CASCADE")
    op.execute("ALTER TABLE sales DROP COLUMN IF EXISTS dest_account")
    op.execute("ALTER TABLE sales DROP COLUMN IF EXISTS payer_card")
    op.execute("ALTER TABLE sales DROP COLUMN IF EXISTS deposited_at")
