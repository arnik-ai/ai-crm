"use client";
import { FileSpreadsheet } from "lucide-react";
import { exportToExcel, type ExcelColumn } from "@/lib/exportExcel";

/**
 * دکمه‌ی «خروجی اکسل».
 *
 * از داده‌ی فعلیِ صفحه (پس از فیلتر/جستجو) یک فایل اکسل (CSV) می‌سازد.
 * اگر داده‌ای نباشد، دکمه غیرفعال است.
 */
export function ExportButton<T extends Record<string, any>>({
  rows,
  columns,
  filename,
  label = "خروجی اکسل",
}: {
  rows: T[];
  columns: ExcelColumn<T>[];
  filename: string;
  label?: string;
}) {
  const disabled = !rows || rows.length === 0;
  return (
    <button
      onClick={() => exportToExcel(rows, columns, filename)}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      title="دریافت خروجی اکسل از داده‌ی نمایش‌داده‌شده"
    >
      <FileSpreadsheet size={16} />
      {label}
    </button>
  );
}
