"""خروجی CSV استریم‌شده برای حجم بالا (۱۰٬۰۰۰+ رکورد).

به‌جای ساختن کل فایل در حافظه، رکوردها را دسته‌دسته از دیتابیس می‌خوانیم و
بلافاصله به پاسخ HTTP می‌نویسیم. این یعنی صرف‌نظر از تعداد رکوردها، مصرف
حافظه‌ی سرور ثابت و کم می‌ماند.

فایل با BOM (UTF-8) تولید می‌شود تا اکسلِ ویندوز فارسی را درست نمایش دهد.
"""
from collections.abc import AsyncIterator, Callable, Sequence
from datetime import datetime
from urllib.parse import quote

from fastapi.responses import StreamingResponse
from sqlalchemy import Select
from sqlalchemy.ext.asyncio import AsyncSession

# ارقام فارسی/عربی → انگلیسی تا اکسل عدد را عدد بشناسد
_FA = "۰۱۲۳۴۵۶۷۸۹"
_AR = "٠١٢٣٤٥٦٧٨٩"
_DIGIT_MAP = {ord(c): str(i) for i, c in enumerate(_FA)}
_DIGIT_MAP.update({ord(c): str(i) for i, c in enumerate(_AR)})


def _cell(value: object) -> str:
    """یک مقدار را به سلولِ CSV امن تبدیل می‌کند."""
    if value is None:
        return ""
    if isinstance(value, datetime):
        s = value.isoformat()
    else:
        s = str(value)
    s = s.translate(_DIGIT_MAP)
    if any(ch in s for ch in (",", '"', "\n", "\r")):
        s = '"' + s.replace('"', '""') + '"'
    return s


async def stream_csv_response(
    session: AsyncSession,
    stmt: Select,
    headers: Sequence[str],
    row_mapper: Callable[[object], Sequence[object]],
    filename: str,
    batch_size: int = 1000,
) -> StreamingResponse:
    """از یک کوئری SQLAlchemy، پاسخِ CSV استریم‌شده می‌سازد.

    - stmt: کوئری SELECT (بدون limit/offset؛ همه‌ی رکوردها).
    - headers: عنوان ستون‌ها (فارسی).
    - row_mapper: هر ردیفِ نتیجه را به دنباله‌ای از مقادیر ستون‌ها تبدیل می‌کند.
    - batch_size: تعداد رکورد در هر دسته‌ی خواندن از دیتابیس.
    """

    async def generate() -> AsyncIterator[bytes]:
        # BOM + سطر عنوان
        yield "﻿".encode("utf-8")
        yield (",".join(_cell(h) for h in headers) + "\r\n").encode("utf-8")

        # خواندن استریم‌شده‌ی رکوردها (بدون بارگذاری کل جدول در حافظه)
        result = await session.stream(stmt.execution_options(yield_per=batch_size))
        async for row in result:
            obj = row[0] if len(row) == 1 else row
            line = ",".join(_cell(v) for v in row_mapper(obj)) + "\r\n"
            yield line.encode("utf-8")

    # نام فایل فارسی را برای هدر Content-Disposition امن می‌کنیم
    safe_name = quote(f"{filename}.csv")
    return StreamingResponse(
        generate(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_name}",
        },
    )
