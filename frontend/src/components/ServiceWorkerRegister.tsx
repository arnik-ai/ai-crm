"use client";
import { useEffect } from "react";

/**
 * ثبت Service Worker برای فعال‌سازی PWA (نصب روی گوشی/دسکتاپ + آفلاین).
 *
 * مسیر sw.js با احتساب basePath ساخته می‌شود تا روی GitHub Pages (/ai-crm)
 * و لوکال هر دو درست کار کند. scope هم همان basePath است.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const swUrl = `${base}/sw.js`;
    const scope = `${base}/`;

    navigator.serviceWorker.register(swUrl, { scope }).catch(() => {
      // ثبت SW اختیاری است؛ در صورت خطا برنامه عادی کار می‌کند.
    });
  }, []);

  return null;
}
