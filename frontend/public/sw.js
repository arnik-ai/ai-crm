/* Service Worker — حالتِ «پاک‌سازی» (بدونِ ری‌لود).
 *
 * نسخه‌های قبلیِ این SW دارایی‌ها را cache-first نگه می‌داشتند و باعث می‌شدند
 * کاربر نسخه‌ی قدیمی (مثلاً حالتِ دمو) را ببیند. این نسخه فقط همه‌ی کش‌ها را
 * پاک می‌کند و خودش را از ثبت خارج می‌کند.
 *
 * ⚠️ نکته‌ی مهم: این SW عمداً دیگر صفحه را navigate/ری‌لود نمی‌کند. نسخه‌ی قبلی
 * روی activate هم unregister می‌کرد و هم client.navigate() می‌زد؛ چون از آن‌طرف
 * ServiceWorkerRegister در هر بارگذاری دوباره register می‌کرد، یک «لوپِ رفرشِ
 * بی‌پایان» می‌ساخت (صفحه هر ثانیه می‌پرید). حذفِ navigate آن لوپ را می‌شکند.
 * (وقتی محصول پایدار شد، می‌توان دوباره PWA را فعال کرد.)
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // ۱) پاک‌کردنِ همه‌ی کش‌ها
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      // ۲) از ثبت خارج‌شدن (دیگر SWی کنترل نمی‌کند)
      await self.registration.unregister();
      // ۳) ⚠️ هیچ ری‌لود/navigate انجام نمی‌شود (رفعِ لوپِ رفرش).
    })()
  );
});

// همه‌ی درخواست‌ها مستقیم از شبکه — بدونِ کش
self.addEventListener("fetch", () => {});
