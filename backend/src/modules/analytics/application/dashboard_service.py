"""سرویس داشبورد — کوئری‌های تجمیعی واقعی روی PostgreSQL.

دسته‌بندی سرنخ بر اساس آخرین lead_score هر دانشجو:
  داغ (hot)  ≥ 70
  گرم (warm) 40..69
  سرد (cold) < 40  (یا بدون امتیاز)
"""
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import Integer, and_, case, distinct, exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.ai_analysis.infrastructure.models import LeadScore
from src.modules.crm.infrastructure.models import Followup, Sale, SalesStage, Student
from src.modules.identity.infrastructure.models import User
from src.modules.telephony.infrastructure.models import Call
from src.shared.utils.jalali import fiscal_month

HOT_THRESHOLD = 70
WARM_THRESHOLD = 40


def _start_of_today() -> datetime:
    now = datetime.now(tz=timezone.utc)
    return datetime.combine(now.date(), time.min, tzinfo=timezone.utc)


# ایران از سال ۲۰۲۲ ساعت تابستانی (DST) ندارد؛ پس آفستِ ثابت +۳:۳۰ درست است.
TEHRAN_OFFSET = timedelta(hours=3, minutes=30)


def _start_of_today_tehran() -> datetime:
    """نیمه‌شبِ «امروزِ تهران»، برگردانده‌شده به‌صورت لحظه‌ی UTC.

    «کارهای روز» باید با مرزِ روزِ تهران حساب شود نه UTC؛ وگرنه بین ۰۰:۰۰ تا ۰۳:۳۰
    بامداد به‌وقت تهران، هنوز «دیروز» نمایش داده می‌شد.
    """
    tehran_now = datetime.now(tz=timezone.utc) + TEHRAN_OFFSET
    midnight = datetime.combine(tehran_now.date(), time.min, tzinfo=timezone.utc)
    return midnight - TEHRAN_OFFSET


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

    async def tasks_today(self, owner_id: str | None) -> dict:
        """کارهای روزِ نیرو: پیگیری‌های امروز + تماس‌های بدون اقدام + بی‌پاسخ‌ها.

        - پیگیری‌های امروز: due_at امروز (به وقت تهران) و وضعیت pending
        - تماس بدون اقدام: تماسِ پاسخ‌داده‌شده‌ی ۷ روز اخیر که outcome ندارد
          (شاملِ تماس‌های روزهای گذشته که هنوز رویشان اقدام نشده)
        - بی‌پاسخ: تماس‌های missed دو روز اخیر

        دامنه (owner_id):
        - اگر None باشد (مدیر/ادمین): همه‌ی کارهای تیم.
        - در غیر این صورت (کارشناس): فقط کارهای خودش؛ اما تماس‌های بی‌صاحب
          (agent_id خالی، مثل تماس‌های ورودی) برای همه دیده می‌شود تا گم نشود.
        """
        today = _start_of_today_tehran()
        end = today + timedelta(days=1)
        week_ago = today - timedelta(days=7)
        two_days_ago = today - timedelta(days=2)

        # شرطِ دامنه‌ی تماس‌ها: مالِ خودِ کارشناس یا بی‌صاحب (برای کارشناس)
        def _call_scope():
            if owner_id is None:
                return []
            return [(Call.agent_id == owner_id) | (Call.agent_id.is_(None))]

        # ۱) پیگیری‌های امروز
        fu_filters = [Followup.due_at >= today, Followup.due_at < end,
                      Followup.status == "pending"]
        if owner_id is not None:
            fu_filters.append(Followup.owner_id == owner_id)
        fu_rows = await self._s.execute(
            select(Followup, Student.full_name, Student.mobile)
            .join(Student, Student.id == Followup.student_id)
            .where(*fu_filters)
            .order_by(Followup.due_at)
        )
        followups = [
            {"id": str(fu.id), "student_name": name or mobile, "mobile": mobile,
             "due_at": fu.due_at.isoformat(), "note": fu.note}
            for fu, name, mobile in fu_rows
        ]

        # ۲) تماس‌های بدون اقدام (۷ روز اخیر، پاسخ‌داده‌شده، بدون outcome)
        pa_rows = await self._s.execute(
            select(Call.id, Call.caller_number, Call.started_at, Student.full_name)
            .outerjoin(Student, Student.id == Call.student_id)
            .where(Call.started_at >= week_ago, Call.outcome.is_(None),
                   Call.status != "missed", *_call_scope())
            .order_by(Call.started_at.desc()).limit(100)
        )
        pending_action = [
            {"id": str(cid), "student_name": name, "mobile": num,
             "started_at": (sa.isoformat() if sa else None)}
            for cid, num, sa, name in pa_rows
        ]

        # ۳) بی‌پاسخ‌های دو روز اخیر
        miss_rows = await self._s.execute(
            select(Call.id, Call.caller_number, Call.started_at, Student.full_name)
            .outerjoin(Student, Student.id == Call.student_id)
            .where(Call.started_at >= two_days_ago, Call.status == "missed",
                   *_call_scope())
            .order_by(Call.started_at.desc()).limit(100)
        )
        missed = [
            {"id": str(cid), "student_name": name, "mobile": num,
             "started_at": (sa.isoformat() if sa else None)}
            for cid, num, sa, name in miss_rows
        ]

        # ۴) یادآور تمدید برنامه: موعدهای تمدید از امروز تا ۵ روز آینده
        renew_until = today + timedelta(days=6)  # شامل ۵ روز کامل پیش‌رو
        ren_filters = [Sale.renewal_due_at.is_not(None),
                       Sale.renewal_due_at >= today,
                       Sale.renewal_due_at < renew_until]
        if owner_id is not None:
            ren_filters.append(Sale.agent_id == owner_id)
        ren_rows = await self._s.execute(
            select(Sale.id, Sale.student_name, Sale.mobile,
                   Sale.renewal_due_at, Sale.program_months)
            .where(*ren_filters)
            .order_by(Sale.renewal_due_at)
        )
        renewal_reminders = [
            {"id": str(sid), "student_name": name or mobile, "mobile": mobile,
             "renewal_due_at": due.isoformat() if due else None,
             "program_months": months}
            for sid, name, mobile, due, months in ren_rows
        ]

        return {
            "followups": followups,
            "pending_action_calls": pending_action,
            "missed_calls": missed,
            "renewal_reminders": renewal_reminders,
        }

    async def calls_missing_next_call(self, owner_id: str | None) -> dict:
        """تماس‌های امروز که اقدام (نتیجه) خورده ولی «تماس بعدی» برایشان تعیین نشده.

        برای یادآور دوره‌ای: «☎️ برای فلانی تایم تماس بعدی رو تعیین نکردی».
        تماس‌های «موفق» (فروش‌شده) را نادیده می‌گیریم تا بی‌مورد یادآوری نشود.
        دامنه: None=مدیر (همه)، در غیر این صورت تماس‌های خودِ کارشناس یا بی‌صاحب.
        """
        today = _start_of_today_tehran()
        now = datetime.now(tz=timezone.utc)
        future_fu = (
            select(Followup.id)
            .where(Followup.student_id == Call.student_id,
                   Followup.due_at > now, Followup.status == "pending")
            .correlate(Call).exists()
        )
        scope = ([] if owner_id is None
                 else [(Call.agent_id == owner_id) | (Call.agent_id.is_(None))])
        rows = await self._s.execute(
            select(Call.id, Call.caller_number, Student.full_name)
            .outerjoin(Student, Student.id == Call.student_id)
            .where(Call.started_at >= today,
                   Call.outcome.is_not(None),
                   Call.outcome.notin_(["successful", "purchased"]),
                   Call.status != "missed",
                   ~future_fu, *scope)
            .order_by(Call.started_at.desc())
            .limit(50)
        )
        items = [
            {"id": str(cid), "student_name": name, "mobile": num}
            for cid, num, name in rows
        ]
        return {"items": items}

    async def hourly_stats(self, tenant_id: str | None,
                           agent_id: str | None = None) -> dict:
        """توزیع ساعتی (به وقت تهران): واریز، پاسخ‌دهی، بی‌پاسخ، فعالیت تماس
        + میانگین مدت مکالمه (کل و به تفکیک نیرو).

        خروجی برای نمودار: آرایه‌های ۲۴تایی (ساعت ۰ تا ۲۳).
        """
        def _tehran(col):
            return func.timezone("Asia/Tehran", col)

        # ساعتِ تماس‌ها
        h_call = func.extract("hour", _tehran(Call.started_at))
        call_filters = [Call.started_at.is_not(None)]
        if agent_id:
            call_filters.append(Call.agent_id == agent_id)
        call_rows = (await self._s.execute(
            select(
                h_call.label("h"),
                func.sum(case((Call.status != "missed", 1), else_=0)).label("answered"),
                func.sum(case((Call.status == "missed", 1), else_=0)).label("missed"),
                func.count(Call.id).label("total"),
            ).where(*call_filters).group_by(h_call)
        )).all()

        # ساعتِ واریزها (فروش)
        h_sale = func.extract("hour", _tehran(Sale.sold_at))
        sale_filters = [Sale.sold_at.is_not(None)]
        if agent_id:
            sale_filters.append(Sale.agent_id == agent_id)
        sale_rows = (await self._s.execute(
            select(
                h_sale.label("h"),
                func.count(Sale.id).label("cnt"),
                func.coalesce(func.sum(Sale.amount), 0).label("amount"),
            ).where(*sale_filters).group_by(h_sale)
        )).all()

        answered = [0] * 24
        missed = [0] * 24
        calls = [0] * 24
        pay_cnt = [0] * 24
        pay_amt = [0.0] * 24
        for r in call_rows:
            i = int(r.h)
            answered[i] = int(r.answered or 0)
            missed[i] = int(r.missed or 0)
            calls[i] = int(r.total or 0)
        for r in sale_rows:
            i = int(r.h)
            pay_cnt[i] = int(r.cnt or 0)
            pay_amt[i] = float(r.amount or 0)

        # میانگین مدت مکالمه (با انتخاب نیرو، فقط مکالماتِ همان نیرو)
        avg_conds = [Call.status != "missed"]
        if agent_id:
            avg_conds.append(Call.agent_id == agent_id)
        avg_all = await self._s.scalar(
            select(func.coalesce(func.avg(Call.duration_sec), 0))
            .where(*avg_conds)
        ) or 0
        per_agent_rows = (await self._s.execute(
            select(User.full_name,
                   func.coalesce(func.avg(Call.duration_sec), 0).label("avg"))
            .join(User, User.id == Call.agent_id)
            .where(Call.status != "missed")
            .group_by(User.full_name)
        )).all()

        return {
            "hours": list(range(24)),
            "answered": answered,
            "missed": missed,
            "calls": calls,
            "payments_count": pay_cnt,
            "payments_amount": pay_amt,
            "avg_duration": {
                "overall_min": round(float(avg_all) / 60, 1),
                "per_agent": [
                    {"agent": n, "min": round(float(a) / 60, 1)}
                    for n, a in per_agent_rows
                ],
            },
        }

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
        successful = await _count(Call.outcome.in_(["successful", "purchased"]))
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

    async def monthly_performance(self, tenant_id: str | None,
                                  months: int = 6) -> dict:
        """پنل «عملکرد نیرو در طول ماه» (مطابق اکسل کارفرما، عکس ۱).

        برای هر کارشناس و هر ماهِ N ماه اخیر، شاخص‌های عملکرد را تجمیع می‌کند:
          - تعداد تماس، جمع دقیقه مکالمه، تعداد پیگیری، تعداد فروش (successful)
        سپس امتیاز کل (از ۱۰۰) و سطح (ضعیف/قابل‌قبول/خوب) را محاسبه می‌کند.

        مقیاس‌پذیری: کل محاسبه با aggregate سمت دیتابیس (group_by ماه+کارشناس)
        انجام می‌شود؛ هیچ رکورد خامی به اپلیکیشن منتقل نمی‌شود.
        """
        start = _start_of_today() - timedelta(days=months * 31)
        # ماهِ مالی شمسی (۱۱ تا ۱۰) در SQL قابل محاسبه نیست؛ پس به تفکیکِ روز
        # تجمیع می‌کنیم و در پایتون هر روز را به ماهِ مالیِ خودش می‌بریم.
        day_col = func.date(Call.started_at).label("day")
        call_rows = await self._s.execute(
            select(
                Call.agent_id.label("agent_id"),
                day_col,
                func.count(Call.id).label("calls"),
                func.coalesce(func.sum(Call.duration_sec), 0).label("sec"),
                func.coalesce(
                    func.sum(case((Call.outcome.in_(["successful", "purchased"]), 1), else_=0)), 0
                ).label("sales"),
                func.coalesce(
                    func.sum(case((Call.outcome == "follow_up", 1), else_=0)), 0
                ).label("followups"),
            )
            .where(Call.started_at >= start, Call.agent_id.isnot(None))
            .group_by(Call.agent_id, day_col)
        )

        # نام کارشناسان (یک کوئری، نه N کوئری)
        user_rows = await self._s.execute(
            select(User.id, User.full_name).where(User.is_active.is_(True))
        )
        names = {u.id: u.full_name for u in user_rows}

        # ساختار: agent_id → { fiscal_key → جمعِ شاخص‌ها }؛ key→label برای نمایش
        agents: dict = {}
        key_label: dict[str, str] = {}
        for r in call_rows:
            d = r.day if isinstance(r.day, date) else date.fromisoformat(str(r.day))
            fkey, flabel = fiscal_month(d)
            key_label[fkey] = flabel
            a = agents.setdefault(
                r.agent_id,
                {"id": str(r.agent_id),
                 "full_name": names.get(r.agent_id, "نامشخص"),
                 "_acc": {}},
            )
            acc = a["_acc"].setdefault(
                fkey, {"calls": 0, "sec": 0, "sales": 0, "followups": 0}
            )
            acc["calls"] += int(r.calls)
            acc["sec"] += int(r.sec)
            acc["sales"] += int(r.sales)
            acc["followups"] += int(r.followups)

        # محاسبه‌ی امتیاز/سطح هر ماهِ مالی و میانگین کارشناس
        result = []
        for a in agents.values():
            a["months"] = {}
            for fkey, acc in a.pop("_acc").items():
                score = self._monthly_score(acc["calls"], acc["sec"],
                                            acc["sales"], acc["followups"])
                a["months"][key_label[fkey]] = {
                    "calls": acc["calls"],
                    "minutes": round(acc["sec"] / 60, 1),
                    "sales": acc["sales"],
                    "followups": acc["followups"],
                    "score": score,
                    "level": self._score_level(score),
                }
            scores = [m["score"] for m in a["months"].values()]
            a["avg_score"] = round(sum(scores) / len(scores), 1) if scores else 0.0
            a["level"] = self._score_level(a["avg_score"])
            result.append(a)
        result.sort(key=lambda x: x["avg_score"], reverse=True)

        # ستون‌های ماه (برچسبِ شمسی) مرتب‌شده بر اساس کلیدِ تاریخی، نزولی
        all_months = [key_label[k] for k in sorted(key_label.keys(), reverse=True)]
        return {"agents": result, "months": all_months}

    @staticmethod
    def _monthly_score(calls: int, sec: int, sales: int, followups: int) -> float:
        """امتیاز ۰..۱۰۰ از ترکیب شاخص‌ها (وزن‌دهیِ ساده و شفاف).

        فروش مهم‌ترین وزن را دارد، سپس تماس، مکالمه و پیگیری. هدف‌ها سقفِ
        امتیازِ کامل هر بخش‌اند (قابل تنظیم در آینده per-tenant).
        """
        minutes = sec / 60
        # وزن‌ها: فروش ۴۰، تماس ۲۵، دقیقه مکالمه ۲۰، پیگیری ۱۵
        sales_pts = min(sales / 20, 1) * 40       # هدف ماهانه: ۲۰ فروش
        calls_pts = min(calls / 300, 1) * 25      # هدف: ۳۰۰ تماس
        minutes_pts = min(minutes / 600, 1) * 20  # هدف: ۶۰۰ دقیقه
        follow_pts = min(followups / 60, 1) * 15  # هدف: ۶۰ پیگیری
        return round(sales_pts + calls_pts + minutes_pts + follow_pts, 1)

    @staticmethod
    def _score_level(score: float) -> str:
        """سطح‌بندی مطابق اکسل کارفرما: ضعیف / قابل قبول / خوب."""
        if score >= 70:
            return "خوب"
        if score >= 40:
            return "قابل قبول"
        return "ضعیف"

    async def daily_performance(self, tenant_id: str | None, days: int = 14) -> dict:
        """جدول «عملکرد روز» (مطابق اکسل کارفرما، عکس ۴) — هر ردیف یک روز.
        ستون‌ها: تاریخ، فروش‌روز، مشتری، موفق، مشترک/مشغول، ناموفق،
        اقدام‌نشده، بی‌پاسخ، پیگیری، جمع تماس، دقیقه."""
        start = _start_of_today() - timedelta(days=days - 1)
        day_col = func.date(Call.started_at).label("day")
        rows = await self._s.execute(
            select(
                day_col,
                func.count(Call.id).label("total"),
                func.coalesce(
                    func.sum(case((Call.outcome.in_(["successful", "purchased"]), 1), else_=0)), 0
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
                # اقدام‌نشده: تماسِ پاسخ‌داده‌شده که هنوز نتیجه (outcome) ثبت نشده
                func.coalesce(
                    func.sum(case(
                        (and_(Call.outcome.is_(None), Call.status != "missed"), 1),
                        else_=0,
                    )), 0
                ).label("not_handled"),
                # مشتری: تماس‌های مرتبط با یک دانشجوی موجود
                func.coalesce(
                    func.sum(case((Call.student_id.isnot(None), 1), else_=0)), 0
                ).label("customers"),
                func.coalesce(func.sum(Call.duration_sec), 0).label("sec"),
            )
            .where(Call.started_at >= start)
            .group_by(day_col)
            .order_by(day_col.desc())
        )
        items = {
            str(r.day): {
                "date": str(r.day),
                "total": int(r.total),
                "successful": int(r.successful),
                "busy": int(r.busy),
                "unsuccessful": int(r.unsuccessful),
                "missed": int(r.missed),
                "follow_up": int(r.follow_up),
                "not_handled": int(r.not_handled),
                "customers": int(r.customers),
                "sales": 0,  # تکمیل از کوئری فروش پایین
                "minutes": round(int(r.sec) / 60, 1),
            }
            for r in rows
        }

        # فروش روز: دانشجویانی که آن روز ساخته شده و به مرحله‌ی ثبت‌نام رسیده‌اند.
        sale_day = func.date(Student.created_at).label("day")
        sale_rows = await self._s.execute(
            select(sale_day, func.count(Student.id).label("sales"))
            .join(SalesStage, SalesStage.id == Student.sales_stage_id)
            .where(
                Student.created_at >= start,
                Student.deleted_at.is_(None),
                SalesStage.is_terminal.is_(True),
                SalesStage.name.notin_(["Lost", "ازدست‌رفته"]),
            )
            .group_by(sale_day)
        )
        for r in sale_rows:
            if str(r.day) in items:
                items[str(r.day)]["sales"] = int(r.sales)

        # مرتب‌سازی نزولی بر اساس تاریخ
        ordered = [items[k] for k in sorted(items.keys(), reverse=True)]
        return {"items": ordered}
