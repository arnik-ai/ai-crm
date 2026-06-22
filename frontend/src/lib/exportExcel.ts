"use client";
/**
 * خروجی اکسل از هر لیست (بدون وابستگی خارجی).
 *
 * فایل CSV با UTF-8 BOM تولید می‌شود تا اکسل فارسی را درست نمایش دهد.
 * این روش روی حالت دمو (GitHub Pages) و بک‌اند واقعی، هر دو کار می‌کند چون
 * از همان داده‌ای که در صفحه نمایش داده می‌شود (پس از فیلتر/جستجو) export می‌گیرد.
 *
 * ستون‌ها به‌صورت {key, label} تعریف می‌شوند تا عنوان فارسی ستون‌ها در فایل بیاید.
 */

export type ExcelColumn<T> = {
  key: keyof T | string;
  label: string;
  /** تبدیل دلخواه مقدار (مثلاً عدد فارسی → انگلیسی، یا فرمت تاریخ). */
  format?: (row: T) => string | number;
};

/** ارقام فارسی/عربی را به انگلیسی برمی‌گرداند تا اکسل عدد را عدد بشناسد. */
function toEnglishDigits(s: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return s.replace(/[۰-۹٠-٩]/g, (d) => {
    const i = fa.indexOf(d);
    if (i > -1) return String(i);
    return String(ar.indexOf(d));
  });
}

/** یک سلول را برای CSV امن می‌کند (نقل‌قول، کاما، خط جدید). */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // اگر عددِ فارسی بود، به انگلیسی تبدیل کن تا قابل محاسبه در اکسل باشد
  s = toEnglishDigits(s);
  if (/[",\n\r]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * از یک آرایه‌ی داده، فایل اکسل (CSV) می‌سازد و دانلود را آغاز می‌کند.
 *
 * @param rows   داده‌ها (همان چیزی که در جدول دیده می‌شود)
 * @param columns ستون‌ها با عنوان فارسی
 * @param filename نام فایل بدون پسوند (تاریخ خودکار اضافه می‌شود)
 */
export function exportToExcel<T extends Record<string, any>>(
  rows: T[],
  columns: ExcelColumn<T>[],
  filename: string,
): void {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const raw = c.format ? c.format(row) : row[c.key as keyof T];
        return escapeCell(raw);
      })
      .join(","),
  );
  const csv = [header, ...lines].join("\r\n");

  // BOM برای نمایش صحیح فارسی در اکسل ویندوز
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
