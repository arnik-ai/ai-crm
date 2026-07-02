"""سرویسِ باشگاه مشتریان — حساب‌ها، پردازشِ رویداد (idempotent)، سطح، تاریخچه.

جریان: رویداد (dict) → قوانینِ فعالِ همان event_type به‌ترتیب priority → موتورِ قطعی →
ثبتِ تراکنش در Ledger با idempotency_key یکتا (ضدِ دوباره‌شماری) → بازمحاسبه‌ی موجودی/سطح.
"""
import secrets
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.loyalty.application.rule_engine import evaluate_rule
from src.modules.loyalty.infrastructure.models import (
    LoyaltyAccount,
    LoyaltyEvent,
    LoyaltyLevel,
    LoyaltyRule,
    PointTransaction,
)


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


class LoyaltyService:
    def __init__(self, session: AsyncSession):
        self._s = session

    # ---------- حساب ----------
    async def get_or_create_account(self, student_id: UUID) -> LoyaltyAccount:
        acc = await self._s.scalar(
            select(LoyaltyAccount).where(LoyaltyAccount.student_id == student_id)
        )
        if acc is None:
            acc = LoyaltyAccount(
                student_id=student_id,
                referral_code=await self._unique_referral_code(),
            )
            self._s.add(acc)
            await self._s.flush()
        return acc

    async def _unique_referral_code(self) -> str:
        """کدِ دعوتِ کوتاهِ یکتا (۸ کاراکترِ خوانا)."""
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # بدونِ حروف/ارقامِ گیج‌کننده
        for _ in range(10):
            code = "".join(secrets.choice(alphabet) for _ in range(8))
            exists = await self._s.scalar(
                select(LoyaltyAccount.id).where(LoyaltyAccount.referral_code == code)
            )
            if not exists:
                return code
        return "".join(secrets.choice(alphabet) for _ in range(10))  # fallback

    # ---------- پردازشِ رویداد ----------
    async def process_event(self, event: dict) -> dict:
        """یک رویداد را پردازش می‌کند. event = {type, student_id, payload, dedup_key?}.

        idempotent: با dedup_key رویداد یک‌بار لاگ می‌شود و هر تراکنش idempotency_key
        یکتا دارد؛ اجرای دوباره امتیازِ تکراری نمی‌دهد.
        """
        etype = event["type"]
        student_id = event.get("student_id")
        payload = event.get("payload") or {}
        dedup = event.get("dedup_key") or f"{etype}:{event.get('entity_id')}"

        if student_id is None:
            return {"skipped": "no_student"}

        # لاگِ رویداد (idempotent؛ اگر قبلاً بود، رد نمی‌کنیم چون تراکنش‌ها خودشان گاردِ یکتا دارند)
        await self._log_event(event, dedup)

        account = await self.get_or_create_account(UUID(str(student_id)))

        rules = (await self._s.execute(
            select(LoyaltyRule)
            .where(LoyaltyRule.event_type == etype, LoyaltyRule.is_active.is_(True))
            .order_by(LoyaltyRule.priority)
        )).scalars().all()

        awarded = 0
        applied: list[str] = []
        for rule in rules:
            if not self._rule_in_window(rule):
                continue
            points = evaluate_rule(rule.definition or {}, payload)
            if points is None or points == 0:
                continue
            idem = f"{dedup}:{rule.key}"
            inserted = await self._add_transaction(
                account_id=account.id, delta=points, reason=rule.key,
                rule_id=rule.id, idempotency_key=idem, meta={"event": etype},
            )
            if inserted:
                awarded += points
                applied.append(rule.key)

        if applied:
            await self._recompute(account)

        await self._s.commit()
        return {"account_id": str(account.id), "awarded": awarded, "rules": applied}

    @staticmethod
    def _rule_in_window(rule: LoyaltyRule) -> bool:
        now = _now()
        if rule.valid_from and rule.valid_from > now:
            return False
        if rule.valid_to and rule.valid_to < now:
            return False
        return True

    async def _add_transaction(self, *, account_id, delta, reason, rule_id,
                               idempotency_key, meta) -> bool:
        """ثبتِ تراکنش با ON CONFLICT DO NOTHING روی idempotency_key.
        خروجی: True اگر واقعاً درج شد (نه تکراری)."""
        stmt = (
            pg_insert(PointTransaction)
            .values(account_id=account_id, delta=delta, reason=reason,
                    rule_id=rule_id, idempotency_key=idempotency_key, meta=meta)
            .on_conflict_do_nothing(index_elements=["idempotency_key"])
            .returning(PointTransaction.id)
        )
        res = await self._s.execute(stmt)
        return res.scalar() is not None

    async def _log_event(self, event: dict, dedup: str) -> None:
        stmt = (
            pg_insert(LoyaltyEvent)
            .values(
                type=event["type"], entity=event.get("entity"),
                entity_id=event.get("entity_id"), student_id=event.get("student_id"),
                payload=event.get("payload"), occurred_at=event.get("occurred_at") or _now(),
                processed_at=_now(), dedup_key=dedup,
            )
            .on_conflict_do_nothing(index_elements=["dedup_key"])
        )
        await self._s.execute(stmt)

    async def _recompute(self, account: LoyaltyAccount) -> None:
        """بازمحاسبه‌ی موجودی/کلِ‌کسب‌شده از Ledger + به‌روزرسانیِ سطح.

        balance = جمعِ همه‌ی deltaها؛ lifetime = جمعِ deltaهای مثبت (مبنای سطحِ صعودی).
        """
        balance = await self._s.scalar(
            select(func.coalesce(func.sum(PointTransaction.delta), 0))
            .where(PointTransaction.account_id == account.id)
        ) or 0
        lifetime = await self._s.scalar(
            select(func.coalesce(func.sum(PointTransaction.delta), 0))
            .where(PointTransaction.account_id == account.id, PointTransaction.delta > 0)
        ) or 0
        account.points_balance = int(balance)
        account.points_lifetime = int(lifetime)
        account.level = await self._level_for(int(lifetime))

    async def _level_for(self, lifetime: int) -> str:
        """بالاترین سطحی که min_points آن ≤ lifetime است."""
        row = await self._s.scalar(
            select(LoyaltyLevel.key)
            .where(LoyaltyLevel.min_points <= lifetime)
            .order_by(LoyaltyLevel.min_points.desc())
            .limit(1)
        )
        return row or "bronze"

    # ---------- خواندن ----------
    async def account_profile(self, student_id: UUID) -> dict:
        acc = await self.get_or_create_account(student_id)
        await self._s.commit()
        return {
            "student_id": str(acc.student_id),
            "points_balance": acc.points_balance,
            "points_lifetime": acc.points_lifetime,
            "level": acc.level,
            "referral_code": acc.referral_code,
        }

    async def transactions(self, student_id: UUID, limit: int = 50) -> list[dict]:
        acc = await self._s.scalar(
            select(LoyaltyAccount).where(LoyaltyAccount.student_id == student_id)
        )
        if acc is None:
            return []
        rows = (await self._s.execute(
            select(PointTransaction)
            .where(PointTransaction.account_id == acc.id)
            .order_by(PointTransaction.created_at.desc())
            .limit(limit)
        )).scalars().all()
        return [
            {"delta": t.delta, "reason": t.reason,
             "created_at": t.created_at.isoformat() if t.created_at else None}
            for t in rows
        ]

    async def leaderboard(self, limit: int = 20) -> list[dict]:
        rows = (await self._s.execute(
            select(LoyaltyAccount)
            .order_by(LoyaltyAccount.points_lifetime.desc())
            .limit(limit)
        )).scalars().all()
        return [
            {"student_id": str(a.student_id), "level": a.level,
             "points_lifetime": a.points_lifetime, "points_balance": a.points_balance}
            for a in rows
        ]

    async def levels(self) -> list[dict]:
        rows = (await self._s.execute(
            select(LoyaltyLevel).order_by(LoyaltyLevel.order_index)
        )).scalars().all()
        return [
            {"key": l.key, "title": l.title, "min_points": l.min_points,
             "benefits": l.benefits}
            for l in rows
        ]
