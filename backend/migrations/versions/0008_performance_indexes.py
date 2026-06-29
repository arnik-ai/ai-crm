"""ایندکس‌های عملکردی برای مقیاس‌پذیری (گزارش‌ها + جستجوی trigram)

فقط افزایشی و ایمن — هیچ داده/رفتاری تغییر نمی‌کند، فقط سرعتِ کوئری‌ها.
- calls(agent_id, started_at): گزارش‌های تیم/ماهانه/روزانه/ساعتیِ هر نیرو.
- calls(outcome): شمارشِ نتایج در گزارش روزانه.
- sales(mobile): گزارشِ «مشتریان چندبارخرید» (group by mobile).
- pg_trgm روی students.full_name و mobile: جستجوی سریعِ ILIKE %...%.

همه idempotent (IF NOT EXISTS). بخشِ trgm دفاعی است: اگر اکستنشن pg_trgm روی
سرویسِ دیتابیس مجاز نبود، بی‌سروصدا رد می‌شود و migration نمی‌شکند.

Revision ID: 0008_perf_indexes
Revises: 0007_installments
Create Date: 2026-06-29
"""
from alembic import op

revision = "0008_perf_indexes"
down_revision = "0007_installments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ایندکس‌های btree (همیشه امن)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_calls_agent_started "
        "ON calls(agent_id, started_at DESC)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_calls_outcome ON calls(outcome)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_mobile ON sales(mobile)")

    # جستجوی trigram (دفاعی: اگر pg_trgm مجاز نبود، رد شو)
    op.execute(
        """
        DO $$
        BEGIN
            CREATE EXTENSION IF NOT EXISTS pg_trgm;
            CREATE INDEX IF NOT EXISTS ix_students_name_trgm
                ON students USING gin (full_name gin_trgm_ops);
            CREATE INDEX IF NOT EXISTS ix_students_mobile_trgm
                ON students USING gin (mobile gin_trgm_ops);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'pg_trgm در دسترس نیست؛ ایندکس‌های trigram رد شدند.';
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_students_mobile_trgm")
    op.execute("DROP INDEX IF EXISTS ix_students_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_sales_mobile")
    op.execute("DROP INDEX IF EXISTS ix_calls_outcome")
    op.execute("DROP INDEX IF EXISTS ix_calls_agent_started")
