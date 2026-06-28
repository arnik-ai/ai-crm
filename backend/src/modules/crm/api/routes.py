"""Routerهای CRM — دانشجو، یادداشت، تگ، پیگیری، دوره (اسکلت با سرویس)."""
from datetime import date, datetime, time, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.crm.api.schemas import (
    DEST_ACCOUNTS,
    JALALI_MONTHS,
    PAYMENT_METHODS,
    PRODUCTS,
    CourseCreate,
    CourseUpdate,
    FollowupCreate,
    InstallmentCreate,
    MessageCreate,
    NoteCreate,
    Paginated,
    SaleCreate,
    StageChange,
    StageCreate,
    StudentCreate,
    StudentOut,
    StudentUpdate,
    TagAttach,
    TagCreate,
)
from src.modules.crm.application.catalog_service import CatalogService
from src.modules.crm.application.installment_service import InstallmentService
from src.modules.crm.application.messaging_service import MessagingService
from src.modules.crm.application.sales_service import SalesService
from src.modules.crm.application.student_service import StudentService
from src.modules.identity.api.dependencies import current_user, require_permission
from src.shared.db.base import get_session
from src.shared.export.csv_stream import stream_csv_response


def _day_start(d: date | None) -> datetime | None:
    """تبدیل تاریخ به ابتدای روز (UTC) برای فیلتر بازه."""
    if d is None:
        return None
    return datetime.combine(d, time.min, tzinfo=timezone.utc)

router = APIRouter()


# ---------- Students ----------
@router.get("/students", response_model=Paginated)
async def list_students(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    stage: UUID | None = None,
    agent: UUID | None = None,
    status: str | None = None,
    q: str | None = None,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> Paginated:
    return await StudentService(session).list(page, size, stage, agent, status, q)


@router.get("/students/export")
async def export_students(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
):
    """خروجی اکسل کاملِ همه‌ی دانشجویان (استریم‌شده برای حجم بالا)."""
    svc = StudentService(session)
    return await stream_csv_response(
        session,
        svc.export_students_query(),
        headers=["نام و نام خانوادگی", "موبایل", "شهر", "رشته", "پایه",
                 "هدف", "منبع تماس", "وضعیت", "مرحله فروش"],
        row_mapper=lambda r: [r.full_name, r.mobile, r.city, r.field, r.grade,
                              r.goal, r.lead_source, r.status, r.stage],
        filename="دانشجویان",
    )


@router.get("/students/incomplete")
async def list_incomplete_students(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> dict:
    """گزارش دانشجویانی که اطلاعاتشان ناقص است (نام/رشته/پایه/هدف/معدل/پیام/توضیح)."""
    return await StudentService(session).list_incomplete()


@router.post("/students", response_model=StudentOut, status_code=201)
async def create_student(
    body: StudentCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> StudentOut:
    return await StudentService(session).create(body, actor_id=user.id)


@router.get("/students/{student_id}", response_model=StudentOut)
async def get_student(
    student_id: UUID,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> StudentOut:
    return await StudentService(session).get(student_id)


@router.patch("/students/{student_id}", response_model=StudentOut)
async def update_student(
    student_id: UUID,
    body: StudentUpdate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> StudentOut:
    return await StudentService(session).update(student_id, body, actor_id=user.id)


@router.delete("/students/{student_id}", status_code=204)
async def delete_student(
    student_id: UUID,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> None:
    await StudentService(session).soft_delete(student_id, actor_id=user.id)


@router.post("/students/{student_id}/stage", response_model=StudentOut)
async def change_stage(
    student_id: UUID,
    body: StageChange,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> StudentOut:
    return await StudentService(session).change_stage(student_id, body.sales_stage_id,
                                                      actor_id=user.id)


# ---------- Notes ----------
@router.post("/students/{student_id}/notes", status_code=201)
async def add_note(
    student_id: UUID,
    body: NoteCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    return await StudentService(session).add_note(student_id, body.body, author_id=user.id)


# ---------- Followups ----------
@router.get("/followups", response_model=Paginated)
async def list_followups(
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("followups:read")),
) -> Paginated:
    return await StudentService(session).list_followups(status, page, size, owner=user.id)


@router.get("/followups/export")
async def export_followups(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("followups:read")),
):
    """خروجی اکسل کاملِ پیگیری‌ها (استریم‌شده)."""
    svc = StudentService(session)
    return await stream_csv_response(
        session,
        svc.export_followups_query(),
        headers=["نام دانشجو", "موبایل", "تاریخ تماس بعدی", "وضعیت", "توضیحات"],
        row_mapper=lambda r: [r.student_name, r.mobile, r.due_at, r.status, r.note],
        filename="پیگیری‌ها",
    )


@router.post("/followups", status_code=201)
async def create_followup(
    body: FollowupCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("followups:write")),
) -> dict:
    return await StudentService(session).create_followup(body, owner_id=user.id)


# ---------- Sales (فیش فروش) ----------
@router.get("/sales/meta")
async def sales_meta(
    user=Depends(require_permission("students:read")),
) -> dict:
    """لیست محصولات، حساب‌های مقصد و گزینه‌های مدت برنامه (برای فرم ثبت فیش)."""
    return {
        "products": PRODUCTS,
        "payment_methods": PAYMENT_METHODS,  # سازگاری؛ در فرم استفاده نمی‌شود
        "accounts": DEST_ACCOUNTS,
        "program_months": list(range(1, 13)),
    }


@router.get("/sales")
async def list_sales(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> dict:
    """لیست فروش‌های ثبت‌شده (فیش‌ها)."""
    return await SalesService(session).list_sales(page, size)


@router.post("/sales", status_code=201)
async def create_sale(
    body: SaleCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    """ثبت فیش فروش جدید (محصول + مدت برنامه + جزئیات واریز)."""
    return await SalesService(session).create_sale(body, agent_id=user.id)


@router.get("/sales/timeline")
async def sales_timeline(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> dict:
    """تایم‌لاینِ ورود→تماس→خرید (تعداد تماس و روز تا خرید)."""
    return await SalesService(session).purchase_timeline()


@router.get("/sales/repeat-customers")
async def sales_repeat_customers(
    min_purchases: int = Query(2, ge=2, le=20),
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> dict:
    """گزارش مشتریانِ چندبارخرید: تعداد خرید، تاریخ‌ها و فاصله‌ی روز بین خریدها."""
    return await SalesService(session).repeat_customers(min_purchases=min_purchases)


@router.get("/sales/export")
async def export_sales(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
):
    """خروجی اکسل کاملِ فروش (استریم‌شده)."""
    svc = SalesService(session)
    return await stream_csv_response(
        session,
        svc.export_sales_query(),
        headers=["نام مشتری", "موبایل", "تاریخ", "محصول", "مدت (ماه)",
                 "مبلغ کل (تومان)", "کارت واریزکننده", "بانک مقصد", "جزئیات واریز"],
        row_mapper=lambda r: [r.student_name, r.mobile, r.sold_at, r.product,
                              r.program_months, float(r.amount) if r.amount is not None else 0,
                              r.payer_card, r.dest_account, r.payment_ref],
        filename="لیست-فروش",
    )


# ---------- Installments (اقساطِ برنامه — افزودنِ دستی مثل شیت اکسل) ----------
@router.get("/installments/meta")
async def installments_meta(
    user=Depends(require_permission("students:read")),
) -> dict:
    """ماه‌های شمسی برای dropdownِ «ماه شروع»."""
    return {"months": JALALI_MONTHS}


@router.get("/installments")
async def list_installments(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> dict:
    return await InstallmentService(session).list()


@router.post("/installments", status_code=201)
async def create_installment(
    body: InstallmentCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    return await InstallmentService(session).create(body)


@router.post("/installments/{plan_id}/toggle/{n}")
async def toggle_installment(
    plan_id: UUID,
    n: int,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    """تیک/برداشتِ قسطِ شماره‌ی n (با کلیک روی خانه‌ی ماه)."""
    return await InstallmentService(session).toggle(plan_id, n)


@router.delete("/installments/{plan_id}", status_code=200)
async def delete_installment(
    plan_id: UUID,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    return await InstallmentService(session).delete(plan_id)


# ---------- Messages (پیامک/واتساپ/تلگرام + گزارش ارتباطات) ----------
@router.post("/messages", status_code=201)
async def create_message(
    body: MessageCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    """ثبت/ارسال پیام (پیامک واقعی؛ واتساپ/تلگرام فقط ثبت می‌شوند)."""
    return await MessagingService(session).create(body, sender_id=user.id)


@router.get("/messages")
async def list_messages(
    date_from: date | None = None,
    date_to: date | None = None,
    student_id: UUID | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> dict:
    """گزارش ارتباطات: چه پیامی در چه بازه‌ای برای چه کسی ارسال شده."""
    # date_to شاملِ کلِ آن روز باشد → تا ابتدای روزِ بعد
    to_dt = _day_start(date_to)
    if to_dt is not None:
        from datetime import timedelta
        to_dt = to_dt + timedelta(days=1)
    return await MessagingService(session).list(
        _day_start(date_from), to_dt, student_id, page, size)


@router.get("/messages/export")
async def export_messages(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
):
    """خروجی اکسلِ گزارش ارتباطات (استریم‌شده)."""
    svc = MessagingService(session)
    channel_fa = {"sms": "پیامک", "whatsapp": "واتساپ", "telegram": "تلگرام"}
    return await stream_csv_response(
        session,
        svc.export_query(),
        headers=["نام", "موبایل", "کانال", "متن پیام", "وضعیت", "تاریخ"],
        row_mapper=lambda r: [
            r.student_name or "—", r.mobile,
            channel_fa.get(r.channel, r.channel), r.body, r.status, r.created_at,
        ],
        filename="گزارش-ارتباطات",
    )


# ---------- Courses ----------
@router.get("/courses")
async def list_courses(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> list[dict]:
    return await CatalogService(session).list_courses()


@router.post("/courses", status_code=201)
async def create_course(
    body: CourseCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("courses:write")),
) -> dict:
    return await CatalogService(session).create_course(body.title, body.slug, body.price)


@router.patch("/courses/{course_id}")
async def update_course(
    course_id: UUID,
    body: CourseUpdate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("courses:write")),
) -> dict:
    return await CatalogService(session).update_course(
        course_id, body.model_dump(exclude_unset=True)
    )


# ---------- Tags ----------
@router.get("/tags")
async def list_tags(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> list[dict]:
    return await CatalogService(session).list_tags()


@router.post("/tags", status_code=201)
async def create_tag(
    body: TagCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    return await CatalogService(session).create_tag(body.name, body.color)


@router.post("/students/{student_id}/tags", status_code=201)
async def attach_tag(
    student_id: UUID,
    body: TagAttach,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    return await CatalogService(session).attach_tag(student_id, body.tag_id)


# ---------- Sales Stages ----------
@router.get("/sales-stages")
async def list_stages(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:read")),
) -> list[dict]:
    return await CatalogService(session).list_stages(tenant_id=user.tenant_id)


@router.post("/sales-stages", status_code=201)
async def create_stage(
    body: StageCreate,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_permission("students:write")),
) -> dict:
    return await CatalogService(session).create_stage(
        body.name, body.order_index, body.is_terminal, body.color,
        tenant_id=user.tenant_id,
    )
