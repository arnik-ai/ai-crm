"""ماژولِ باشگاه مشتریان (Loyalty) — فاز ۲: پاداش، مصرف، معرفی

جدول‌های `loyalty_rewards` / `loyalty_redemptions` / `loyalty_referrals` (بازهم بدونِ FK
سختِ هسته → حذفِ آسان) + seedِ پاداش‌های پیش‌فرض. idempotent.

⚠️ حذف: downgrade فقط این سه جدول را drop می‌کند. هیچ چیزِ هسته/فاز۱ لمس نمی‌شود.

Revision ID: 0011_loyalty_phase2
Revises: 0010_loyalty
Create Date: 2026-07-03
"""
from alembic import op

revision = "0011_loyalty_phase2"
down_revision = "0010_loyalty"
branch_labels = None
depends_on = None

_COMMON = (
    "id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "
    "created_at timestamptz NOT NULL DEFAULT now(), "
    "updated_at timestamptz NOT NULL DEFAULT now()"
)


def upgrade() -> None:
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS loyalty_rewards (
            {_COMMON},
            key         text UNIQUE,
            title       text,
            cost_points int  NOT NULL,
            type        text NOT NULL,
            payload     jsonb,
            min_level   text,
            stock       int,
            is_active   bool NOT NULL DEFAULT true
        );
    """)

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS loyalty_redemptions (
            {_COMMON},
            account_id   uuid,
            reward_id    uuid,
            points_spent int  NOT NULL DEFAULT 0,
            status       text NOT NULL DEFAULT 'approved',
            coupon_code  text,
            expires_at   timestamptz,
            meta         jsonb
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_redemptions_account ON loyalty_redemptions(account_id)")

    op.execute(f"""
        CREATE TABLE IF NOT EXISTS loyalty_referrals (
            {_COMMON},
            referrer_account_id uuid,
            referred_student_id uuid,
            code_used           text,
            status              text NOT NULL DEFAULT 'pending',
            signup_rewarded     bool NOT NULL DEFAULT false,
            purchase_rewarded   bool NOT NULL DEFAULT false
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_referrals_referrer ON loyalty_referrals(referrer_account_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_referrals_referred ON loyalty_referrals(referred_student_id)")

    # --- seed: پاداش‌های پیش‌فرض (مطابقِ سند) ---
    op.execute("""
        INSERT INTO loyalty_rewards (key, title, cost_points, type, payload, min_level) VALUES
          ('free_session',  'یک جلسه مشاوره رایگان', 1000, 'free_session',  NULL,              NULL),
          ('discount_10',   '۱۰٪ تخفیف دوره بعدی',   1500, 'discount',      '{"percent":10}'::jsonb, NULL),
          ('private_class', 'کلاس خصوصی رایگان',     2000, 'private_class', NULL,              'gold'),
          ('free_course',   'یک دوره رایگان',         3000, 'free_course',   NULL,              'gold')
        ON CONFLICT (key) DO NOTHING;
    """)


def downgrade() -> None:
    for t in ("loyalty_referrals", "loyalty_redemptions", "loyalty_rewards"):
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
