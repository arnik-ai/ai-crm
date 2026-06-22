/* Service Worker ساده برای PWA.
 *
 * استراتژی: network-first برای ناوبری (HTML) تا همیشه آخرین نسخه دیده شود،
 * و cache-first برای دارایی‌های استاتیک (JS/CSS/فونت/آیکون) برای سرعت و آفلاین.
 *
 * نکته: scope این SW برابر مسیری است که در آن ثبت می‌شود (با احتساب basePath).
 */
const CACHE = "crm-pwa-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // فقط درخواست‌های همان مبدأ را مدیریت می‌کنیم (نه API/دامنه‌های دیگر)
  if (url.origin !== self.location.origin) return;
  // درخواست‌های API را دست نمی‌زنیم (همیشه شبکه)
  if (url.pathname.includes("/api/")) return;

  // ناوبری صفحات: شبکه اول، در نبود شبکه از کش
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./")))
    );
    return;
  }

  // دارایی‌های استاتیک: کش اول
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
    )
  );
});
