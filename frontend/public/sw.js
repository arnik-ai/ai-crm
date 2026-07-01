/* Service Worker — حالتِ «پاک‌سازی».
 *
 * نسخه‌های قبلیِ این SW دارایی‌ها را cache-first نگه می‌داشتند و باعث می‌شدند
 * کاربر نسخه‌ی قدیمی (مثلاً حالتِ دمو) را ببیند. این نسخه همه‌ی کش‌ها را پاک
 * می‌کند، خودش را از ثبت خارج می‌کند و صفحه‌ها را تازه می‌کند تا همه به
 * جدیدترین نسخه برسند. (وقتی محصول پایدار شد، می‌توان دوباره PWA را فعال کرد.)
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
      // ۲) گرفتنِ کنترلِ همه‌ی تب‌ها
      await self.clients.claim();
      // ۳) از ثبت خارج‌شدن (دیگر SWی کنترل نمی‌کند)
      await self.registration.unregister();
      // ۴) تازه‌کردنِ همه‌ی تب‌های باز تا نسخه‌ی جدید بارگذاری شود
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});

// همه‌ی درخواست‌ها مستقیم از شبکه — بدونِ کش
self.addEventListener("fetch", () => {});
