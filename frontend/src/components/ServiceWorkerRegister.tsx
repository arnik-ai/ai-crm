"use client";
import { useEffect } from "react";

/**
 * پاک‌سازیِ Service Worker (نه ثبتِ آن).
 *
 * این اپ فعلاً PWA نیست (حالتِ پاک‌سازی)، پس این کامپوننت دیگر SW ثبت نمی‌کند.
 * فقط اگر SWی از نسخه‌های قبلی روی مرورگرِ کاربر مانده باشد، آن را unregister و
 * کش‌هایش را پاک می‌کند.
 *
 * ⚠️ چرا register حذف شد: ثبتِ دوباره در هر بارگذاری + navigate داخلِ خودِ SW
 * یک «لوپِ رفرشِ بی‌پایان» می‌ساخت (صفحه هر ثانیه می‌پرید). با نبودِ register
 * و نبودِ navigate (در sw.js)، لوپ کاملاً بسته می‌شود.
 * (وقتی خواستیم دوباره PWA فعال شود، این‌جا register را برمی‌گردانیم.)
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // unregister همه‌ی SWهای ثبت‌شده‌ی قبلی
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => reg.unregister()))
        .catch(() => {
          // بی‌اهمیت است؛ در صورت خطا برنامه عادی کار می‌کند.
        });
    }

    // پاک‌کردنِ کش‌های باقی‌مانده‌ی SW قدیمی
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
    }
  }, []);

  return null;
}
