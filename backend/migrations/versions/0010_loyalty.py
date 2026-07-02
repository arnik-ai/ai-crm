"""ماژولِ باشگاه مشتریان (Loyalty) — فاز ۱

جدول‌های `loyalty_*` (کاملاً مستقل، بدونِ FK سختِ جدول‌های هسته → حذفِ آسان) +
seedِ سطوح و قوانینِ پایه. همه idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING).

⚠️ حذفِ کاملِ ماژول = اجرای downgrade این migration (فقط جدول‌های loyalty_* را drop
می‌کند؛ هیچ جدول/ستونِ هسته لمس نمی‌شود) + حذفِ پوشه‌ی modules/loyalty/. جزئیات در
docs/12-LOYALTY-CLUB.md.

Revision ID: 0010_loyalty
Revises: 0009_student_last_outcome
Create Date: 2026-07-03
"""
from alembic import op

revision = "0010_loyalty"
down_revision = "0009_student_last_outcome"
branch_labels = None
depends_on = None

# id/created_at/updated_at مطابقِ Base مشترک (gen_random_uuid نیاز به pgcrypto دارد
# که در schema.sql/0001 ساخته شده). student_id/account_id ارجاعِ «نرم» (بدونِ FK).
_COMMON = (
    "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
    "created_at timestamptz NOT NULL DEFAULT now(), "
    "updated_at timestamptz NOT NULL DEFAULT now()"
)


def upgrade() -> None:
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS loyalty_accounts (
            {_COMMON},
            student_id      uuid UNIQUE,
            points_balance  int  NOT NULL DEFAULT 0,
            points_lifetime int  NOT NULL DEFAULT 0,
            level           text NOT NULL DEFAULT 'bronze',
            referral_code   text UNIQUE,
            referred_by     uuid,
            birthday        date
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_accounts_student ON loyalty_accounts(student_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS loyalty_point_transactions (
            {_COMMON},
            account_id      uuid,
            delta           int  NOT NULL,
            reason          text,
            event_id        uuid,
            rule_id         uuid,
            idempotency_key text UNIQUE,
            meta            jsonb
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_tx_account ON loyalty_point_transactions(account_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS loyalty_levels (
            {_COMMON},
            key         text UNIQUE NOT NULL,
            title       text,
            min_points  int  NOT NULL,
            order_index int  NOT NULL,
            benefits    jsonb
        );
    """)

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS loyalty_rules (
            {_COMMON},
            key        text UNIQUE NOT NULL,
            event_type text,
            definition jsonb,
            priority   int  NOT NULL DEFAULT 100,
            is_active  bool NOT NULL DEFAULT true,
            version    int  NOT NULL DEFAULT 1,
            valid_from timestamptz,
            valid_to   timestamptz
        );
    """)

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS loyalty_events (
            {_COMMON},
            type         text NOT NULL,
            entity       text,
            entity_id    uuid,
            student_id   uuid,
            payload      jsonb,
            occurred_at  timestamptz NOT NULL DEFAULT now(),
            processed_at timestamptz,
            dedup_key    text UNIQUE
        );
    """)

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS loyalty_checkpoints (
            {_COMMON},
            source  text UNIQUE NOT NULL,
            last_ts timestamptz
        );
    """)

    # --- seed: سطوح (Bronze/Silver/Gold/Platinum) ---
    # ⚠️ exec_driver_sql (نه op.execute): چون JSON شاملِ «:عدد» است و op.execute آن را
    # به‌اشتباه bind-parameter می‌بیند و کرش می‌کند. exec_driver_sql پارامتر پارس نمی‌کند.
    bind = op.get_bind()
    bind.exec_driver_sql("""
        INSERT INTO loyalty_levels (key, title, min_points, order_index, benefits) VALUES
          ('bronze',   'برنزی',   0,    1, '[{"type":"discount","value":0}]'::jsonb),
          ('silver',   'نقره‌ای', 500,  2, '[{"type":"discount","value":5},{"type":"priority_support"}]'::jsonb),
          ('gold',     'طلایی',   1500, 3, '[{"type":"discount","value":10},{"type":"priority_support"},{"type":"free_session"}]'::jsonb),
          ('platinum', 'پلاتینی', 3000, 4, '[{"type":"discount","value":15},{"type":"priority_support"},{"type":"free_session"},{"type":"free_course"}]'::jsonb)
        ON CONFLICT (key) DO NOTHING;
    """)

    # --- seed: قوانینِ پایه (compute ساختاریافته و قطعی — نه فرمولِ آزاد) ---
    bind.exec_driver_sql("""
        INSERT INTO loyalty_rules (key, event_type, definition, priority) VALUES
          ('call_success', 'call.completed',
           '{"when":[{"field":"outcome","op":"in","value":["successful","purchased"]}],"compute":{"type":"fixed","points":10}}'::jsonb, 100),
          ('call_answered', 'call.completed',
           '{"when":[{"field":"status","op":"!=","value":"missed"},{"field":"outcome","op":"not_in","value":["successful","purchased"]}],"compute":{"type":"fixed","points":5}}'::jsonb, 110),
          ('call_missed', 'call.completed',
           '{"when":[{"field":"status","op":"==","value":"missed"}],"compute":{"type":"fixed","points":-5}}'::jsonb, 120),
          ('purchase_points', 'purchase.created',
           '{"compute":{"type":"ratio","per":100000,"points":10,"max":1000}}'::jsonb, 100),
          ('purchase_2nd_bonus', 'purchase.created',
           '{"when":[{"field":"purchase_index","op":">=","value":2}],"compute":{"type":"fixed","points":200}}'::jsonb, 110)
        ON CONFLICT (key) DO NOTHING;
    """)


def downgrade() -> None:
    # فقط جدول‌های loyalty_* — هیچ چیزِ هسته لمس نمی‌شود.
    for t in (
        "loyalty_checkpoints", "loyalty_events", "loyalty_rules",
        "loyalty_levels", "loyalty_point_transactions", "loyalty_accounts",
    ):
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
