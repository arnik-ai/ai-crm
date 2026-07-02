"""Projection — تبدیلِ رخدادهای هسته (sales/calls) به رویدادهای loyalty، بدونِ دست‌زدن به هسته.

⚠️ چرا SQL خام: عمداً مدل‌های هسته (Sale/Call) را import نمی‌کنیم تا ماژول کاملاً مستقل
و حذف‌شدنی بماند (هیچ importی به هسته). فقط جدول‌های `sales`/`calls` را فقط-خواندنی می‌خوانیم.
اگر ماژول حذف شود، این فایل هم می‌رود و هسته دست‌نخورده است.

idempotency: هر ردیف dedup_key یکتا می‌گیرد (`sale:{id}` / `call:{id}`)؛ حتی اگر بازه‌ها
هم‌پوشانی داشته باشند، تراکنشِ تکراری ثبت نمی‌شود. checkpoint فقط برای کارآمدیِ اسکن است.
"""
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.loyalty.application.loyalty_service import LoyaltyService
from src.modules.loyalty.infrastructure.models import LoyaltyCheckpoint


class Projection:
    def __init__(self, session: AsyncSession):
        self._s = session
        self._svc = LoyaltyService(session)

    async def _checkpoint(self, source: str) -> datetime | None:
        cp = await self._s.scalar(
            select(LoyaltyCheckpoint).where(LoyaltyCheckpoint.source == source)
        )
        return cp.last_ts if cp else None

    async def _set_checkpoint(self, source: str, ts: datetime) -> None:
        cp = await self._s.scalar(
            select(LoyaltyCheckpoint).where(LoyaltyCheckpoint.source == source)
        )
        if cp is None:
            cp = LoyaltyCheckpoint(source=source, last_ts=ts)
            self._s.add(cp)
        else:
            cp.last_ts = ts
        await self._s.commit()

    async def scan(self, limit: int = 500) -> dict:
        """اسکنِ یک‌بارِ فروش‌ها و تماس‌های جدید و امتیازدهیِ آن‌ها.
        (قابلِ فراخوانی از endpoint ادمین یا Celery-beat در آینده.)"""
        sales = await self._scan_sales(limit)
        calls = await self._scan_calls(limit)
        return {"sales_processed": sales, "calls_processed": calls}

    async def _scan_sales(self, limit: int) -> int:
        since = await self._checkpoint("sales")
        # purchase_index = تعدادِ فروش‌های همان دانش‌آموز تا این فروش (۱-based) برای بونوسِ خریدِ دوم
        q = text("""
            SELECT s.id, s.student_id, s.amount, s.sold_at,
                   (SELECT count(*) FROM sales s2
                    WHERE s2.student_id = s.student_id AND s2.sold_at <= s.sold_at) AS purchase_index
            FROM sales s
            WHERE s.student_id IS NOT NULL
              AND (:since IS NULL OR s.sold_at > :since)
            ORDER BY s.sold_at ASC
            LIMIT :limit
        """)
        rows = (await self._s.execute(q, {"since": since, "limit": limit})).mappings().all()
        last_ts = since
        for r in rows:
            await self._svc.process_event({
                "type": "purchase.created", "entity": "sale", "entity_id": r["id"],
                "student_id": r["student_id"], "occurred_at": r["sold_at"],
                "dedup_key": f"sale:{r['id']}",
                "payload": {"amount": float(r["amount"] or 0),
                            "purchase_index": int(r["purchase_index"] or 1)},
            })
            last_ts = r["sold_at"]
        if rows and last_ts:
            await self._set_checkpoint("sales", last_ts)
        return len(rows)

    async def _scan_calls(self, limit: int) -> int:
        since = await self._checkpoint("calls")
        q = text("""
            SELECT c.id, c.student_id, c.status, c.outcome, c.started_at
            FROM calls c
            WHERE c.student_id IS NOT NULL
              AND (:since IS NULL OR c.started_at > :since)
            ORDER BY c.started_at ASC
            LIMIT :limit
        """)
        rows = (await self._s.execute(q, {"since": since, "limit": limit})).mappings().all()
        last_ts = since
        for r in rows:
            await self._svc.process_event({
                "type": "call.completed", "entity": "call", "entity_id": r["id"],
                "student_id": r["student_id"], "occurred_at": r["started_at"],
                "dedup_key": f"call:{r['id']}",
                "payload": {"status": r["status"], "outcome": r["outcome"]},
            })
            last_ts = r["started_at"]
        if rows and last_ts:
            await self._set_checkpoint("calls", last_ts)
        return len(rows)
