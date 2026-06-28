"""افزودن معدل (gpa) به students و ساخت جدول messages (لاگ ارتباطات)

idempotent است (IF NOT EXISTS) تا با schema.sql هم‌خوان بماند.

Revision ID: 0005_gpa_messages
Revises: 0004_sales
Create Date: 2026-06-24
"""
from alembic import op

revision = "0005_gpa_messages"
down_revision = "0004_sales"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS gpa numeric(4,2)")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            student_id uuid REFERENCES students(id) ON DELETE SET NULL,
            sender_id  uuid REFERENCES users(id) ON DELETE SET NULL,
            mobile     text,
            channel    text NOT NULL,
            body       text NOT NULL,
            status     text NOT NULL DEFAULT 'sent',
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_messages_student ON messages(student_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_messages_created ON messages(created_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS messages CASCADE")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS gpa")
