"use client";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { faNum } from "@/lib/utils";

/**
 * صفحه‌بندی برای لیست‌های بزرگ (مقیاس بالا).
 *
 * بک‌اند page/size/total را برمی‌گرداند؛ این کامپوننت ناوبری صفحات را می‌سازد.
 * اگر کل رکوردها از یک صفحه کمتر باشد (مثل حالت دمو) چیزی نشان داده نمی‌شود.
 *
 * توجه: در RTL، دکمه‌ی «بعدی» سمت چپ و «قبلی» سمت راست منطقی‌تر است؛ آیکون‌ها
 * مطابق همان جهت انتخاب شده‌اند.
 */
export function Pagination({
  page,
  size,
  total,
  onPage,
}: {
  page: number;
  size: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size) return null; // یک صفحه — نیازی به ناوبری نیست

  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-sm">
      <div className="text-slate-400">
        نمایش {faNum(from)}–{faNum(to)} از {faNum(total)}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={16} /> قبلی
        </button>
        <span className="px-2 text-slate-500">
          صفحه {faNum(page)} از {faNum(pages)}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          بعدی <ChevronLeft size={16} />
        </button>
      </div>
    </div>
  );
}
