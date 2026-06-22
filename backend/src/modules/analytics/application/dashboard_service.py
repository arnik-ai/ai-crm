"""سرویس داشبورد — کوئری‌های تجمیعی واقعی روی PostgreSQL.

دسته‌بندی سرنخ بر اساس آخرین lead_score هر دانشجو:
  داغ (hot)  ≥ 70
  گرم (warm) 40..69
  سرد (cold) < 40  (یا بدون امتیاز)
"""
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import Integer, and_, case, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.ai_analysis.infrastructure.models import LeadScore
from src.modules.crm.infrastructure.models import Followup, SalesStage, Student
from src.modules.identity.infrastructure.models import User
from src.modules.telephony.infrastructure.models import Call

HOT_THRESHOLD = 70
WARM_THRESHOLD = 40


def _start_of_today() -> datetime:
    now = datetime.now(tz=timezone.utc)
    return datetime.combine(now.date(), time.min, tzinfo=timezone.utc)


def _latest_score_subquery():
    """زیرکوئری: آخرین امتیاز هر دانشجو (بر اساس created_at)."""
    ranked = (
        select(
            LeadScore.student_id.label("student_id"),
            LeadScore.score.label("score"),
            func.row_number()
            .over(
                partition_by=LeadScore.student_id,
                order_by=LeadScore.created_at.desc(),
            )
            .label("rn"),
        )
        .subquery()
    )
    return select(ranked.c.student_id, ranked.c.score).where(ranked.c.rn == 1).subquery()


class DashboardService:
    def __init__(self, session: AsyncSession):
        self._s = session

    async def summary(self, tenant_id: str | None) -> dict:
        today = _start_of_today()
        week_ago = today - timedelta(days=7)

        calls_today = await self._s.scalar(
            select(func.count(Call.id)).where(Call.started_at >= today)
        )
        calls_week = await self._s.scalar(
            select(func.count(Call.id)).where(Call.started_at >= week_ago)
        )

        # دسته‌بندی سرنخ‌ها بر اساس آخرین امتیاز
        latest = _latest_score_subquery()
        buckets = await self._s.execute(
            select(
                func.coalesce(
                    func.sum(case((latest.c.score >= HOT_THRESHOLD, 1), else_=0)), 0
                ).label("hot"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                and_(
                                    latest.c.score >= WARM_THRESHOLD,
                                    latest.c.score < HOT_THRESHOLD,
                                ),
                                1,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("warm"),
                func.coalesce(
                    func.sum(case((latest.c.score < WARM_THRESHOLD, 1), else_=0)), 0
                ).label("cold"),
            )
        )
        hot, warm, cold = buckets.one()

        # سرنخ‌های فعالِ بدون هیچ امتیاز هم سرد محسوب می‌شوند
        scored_students = select(distinct(latest.c.student_id)).scalar_subquery()
        unscored_active = await self._s.scalar(
            select(func.count(Student.id)).where(
                Student.deleted_at.is_(None),
                Student.status == "active",
                Student.id.notin_(scored_students),
            )
        )

        end_of_today = today + timedelta(days=1)
        followups_today = await self._s.scalar(
            select(func.count(Followup.id)).where(
                Followup.due_at >= today,
                Followup.due_at < end_of_today,
                Followup.status == "pending",
            )
        )

        conversion_rate = await self._conversion_rate()

        return {
            "calls_today": calls_today or 0,
            "calls_week": calls_week or 0,
            "hot_leads": int(hot or 0),
            "warm_leads": int(warm or 0),
            "cold_leads": int(cold or 0) + int(unscored_active or 0),
            "followups_today": followups_today or 0,
            "conversion_rate": round(conversion_rate, 3),
        }

    async def funnel(self, tenant_id: str | None) -> dict:
        """توزیع سرنخ‌ها در مراحل فروش، مرتب بر اساس order_index."""
        rows = await self._s.execute(
            select(
                SalesStage.id,
                SalesStage.name,
                SalesStage.order_index,
                SalesStage.color,
                func.count(Student.id).label("count"),
            )
            .outerjoin(
                Student,
                and_(
                    Student.sales_stage_id == SalesStage.id,
                    Student.deleted_at.is_(None),
                ),
            )
            .group_by(SalesStage.id, SalesStage.name, SalesStage.order_index,
                      SalesStage.color)
            .order_by(SalesStage.order_index)
        )
        stages = [
            {"id": str(r.id), "name": r.name, "order_index": r.order_index,
             "color": r.color, "count": r.count}
            for r in rows
        ]
        return {"stages": stages}

    async def team_performance(self, tenant_id: str | None) -> dict:
        """عملکرد هر کارشناس: تعداد سرنخ‌ها و تماس‌های مدیریت‌شده."""
        student_counts = (
            select(
                Student.assigned_agent_id.label("agent_id"),
                func.count(Student.id).label("students"),
            )
            .where(Student.deleted_at.is_(None))
            .group_by(Student.assigned_agent_id)
            .subquery()
        )
        call_counts = (
            select(
                Call.agent_id.label("agent_id"),
                func.count(Call.id).label("calls"),
            )
            .group_by(Call.agent_id)
            .subquery()
        )
        rows = await self._s.execute(
            select(
                User.id,
                User.full_name,
                func.coalesce(student_counts.c.students, 0).label("students"),
                func.coalesce(call_counts.c.calls, 0).label("calls"),
            )
            .outerjoin(student_counts, student_counts.c.agent_id == User.id)
            .outerjoin(call_counts, call_counts.c.agent_id == User.id)
            .where(User.is_active.is_(True))
            .order_by(func.coalesce(student_counts.c.students, 0).desc())
        )
        agents = [
            {"id": str(r.id), "full_name": r.full_name,
             "students": int(r.students), "calls": int(r.calls)}
            for r in rows
        ]
        return {"agents": agents}

    async def followups_today(self, owner_id: str) -> dict:
        today = _start_of_today()
        end = today + timedelta(days=1)
        rows = await self._s.execute(
            select(Followup, Student.full_name, Student.mobile)
            .join(Student, Student.id == Followup.student_id)
            .where(
                Followup.due_at >= today,
                Followup.due_at < end,
                Followup.status == "pending",
            )
            .order_by(Followup.due_at)
        )
        items = [
            {
                "id": str(fu.id),
                "student_id": str(fu.student_id),
                "student_name": name or mobile,
                "due_at": fu.due_at.isoformat(),
                "note": fu.note,
            }
            for fu, name, mobile in rows
        ]
        return {"items": items}

    async def calls_trend(self, tenant_id: str | None, days: int = 7) -> dict:
        """روند تعداد تماس‌ها در N روز اخیر، به تفکیک ورودی/خروجی (برای نمودار خطی)."""
        start = _start_of_today() - timedelta(days=days - 1)
        day_col = func.date(Call.started_at).label("day")
        rows = await self._s.execute(
            select(
                day_col,
                func.coalesce(
                    func.sum(case((Call.direction == "inbound", 1), else_=0)), 0
                ).label("inbound"),
                func.coalesce(
                    func.sum(case((Call.direction == "outbound", 1), else_=0)), 0
                ).label("outbound"),
            )
            .where(Call.started_at >= start)
            .group_by(day_col)
            .order_by(day_col)
        )
        by_day = {str(r.day): (int(r.inbound), int(r.outbound)) for r in rows}

        # پر کردن روزهای خالی تا نمودار پیوسته باشد
        points = []
        for i in range(days):
            d = (start + timedelta(days=i)).date()
            inbound, outbound = by_day.get(str(d), (0, 0))
            points.append({
                "date": str(d),
                "inbound": inbound,
                "outbound": outbound,
                "total": inbound + outbound,
            })
        return {"points": points}

    async def _conversion_rate(self) -> float:
        """نرخ تبدیل = سرنخ‌های مرحله‌ی نهاییِ ثبت‌نام‌شده ÷ کل سرنخ‌های فعال."""
        total = await self._s.scalar(
            select(func.count(Student.id)).where(Student.deleted_at.is_(None))
        )
        if not total:
            return 0.0
        # مرحله‌ی پایانیِ موفق: نامِ شامل «Registration» یا is_terminal و غیر Lost
        converted = await self._s.scalar(
            select(func.count(Student.id))
            .join(SalesStage, SalesStage.id == Student.sales_stage_id)
            .where(
                Student.deleted_at.is_(None),
                SalesStage.is_terminal.is_(True),
                SalesStage.name.ilike("%Registration%"),
            )
        )
        return (converted or 0) / total

    async def daily_report(self, tenant_id: str | None, target_day: datetime) -> dict:
        """گزارش روزانه‌ی تماس‌ها برای یک روز مشخص (مطابق اکسل کارفرما):
        تعداد ورودی/خروجی/بی‌پاسخ + نتیجه‌ی فروش (موفق/مشترک/ناموفق/پیگیری) + جمع زمان مکالمه."""
        start = datetime.combine(target_day.date(), time.min, tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        base = (Call.started_at >= start, Call.started_at < end)

        async def _count(*conds) -> int:
            return await self._s.scalar(
                select(func.count(Call.id)).where(*base, *conds)
            ) or 0

        inbound = await _count(Call.direction == "inbound", Call.status != "missed")
        outbound = await _count(Call.direction == "outbound")
        missed = await _count(Call.status == "missed")
        # نتیجه‌ی فروشِ دستی (فیلد outcome)
        successful = await _count(Call.outcome == "successful")
        unsuccessful = await _count(Call.outcome == "unsuccessful")
        busy = await _count(Call.outcome == "busy")
        follow_up = await _count(Call.outcome == "follow_up")

        total_sec = await self._s.scalar(
            select(func.coalesce(func.sum(Call.duration_sec), 0)).where(*base)
        ) or 0

        return {
            "date": str(start.date()),
            "inbound": inbound,
            "outbound": outbound,
            "missed": missed,
            "successful": successful,
            "unsuccessful": unsuccessful,
            "busy": busy,
            "follow_up": follow_up,
            "total_calls": inbound + outbound,
            "total_minutes": round(total_sec / 60, 1),
        }

    async def daily_performance(self, tenant_id: str | None, days: int = 14) -> dict:
        """جدول «عملکرد روز» (مطابق اکسل کارفرما) — هر ردیف یک روز در N روز اخیر.
        ستون‌ها: تاریخ، موفق، مشترک، ناموفق، بی‌پاسخ، پیگیری، جمع تماس، دقیقه."""
        start = _start_of_today() - timedelta(days=days - 1)
        day_col = func.date(Call.started_at).label("day")
        rows = await self._s.execute(
            select(
                day_col,
                func.count(Call.id).label("total"),
                func.coalesce(
                    func.sum(case((Call.outcome == "successful", 1), else_=0)), 0
                ).label("successful"),
                func.coalesce(
                    func.sum(case((Call.outcome == "busy", 1), else_=0)), 0
                ).label("busy"),
                func.coalesce(
                    func.sum(case((Call.outcome == "unsuccessful", 1), else_=0)), 0
                ).label("unsuccessful"),
                func.coalesce(
                    func.sum(case((Call.status == "missed", 1), else_=0)), 0
                ).label("missed"),
                func.coalesce(
                    func.sum(case((Call.outcome == "follow_up", 1), else_=0)), 0
                ).label("follow_up"),
                func.coalesce(func.sum(Call.duration_sec), 0).label("sec"),
            )
            .where(Call.started_at >= start)
            .group_by(day_col)
            .order_by(day_col.desc())
        )
        items = [
            {
                "date": str(r.day),
                "total": int(r.total),
                "successful": int(r.successful),
                "busy": int(r.busy),
                "unsuccessful": int(r.unsuccessful),
                "missed": int(r.missed),
                "follow_up": int(r.follow_up),
                "minutes": round(int(r.sec) / 60, 1),
            }
            for r in rows
        ]
        return {"items": items}
