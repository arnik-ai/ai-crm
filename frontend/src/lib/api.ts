import axios from "axios";
import { demoByPath } from "./demoData";

// حالت دمو: به‌صورت پیش‌فرض روشن است (برای نمایش ظاهر روی Vercel بدون بک‌اند).
// وقتی بک‌اند واقعی وصل شد، با تنظیم NEXT_PUBLIC_DEMO=0 خاموش می‌شود.
const DEMO_FORCED = process.env.NEXT_PUBLIC_DEMO !== "0";

// آدرسِ بک‌اندِ واقعی. اگر خالی باشد (لوکال)، مسیرِ نسبی استفاده می‌شود و rewrites
// در next.config پراکسی می‌کند. روی GitHub Pages این مقدار به سرورِ https تنظیم می‌شود.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

function demoFor(url?: string) {
  if (!url) return undefined;
  const path = url.replace(/^\/api\/v1/, "").split("?")[0];
  return demoByPath[path];
}

export const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  headers: { "Content-Type": "application/json" },
});

/**
 * متنِ خطای واقعیِ بک‌اند را از پاسخ بیرون می‌کشد (به‌جای پیامِ کلیِ گمراه‌کننده).
 *
 * - خطاهای دامنه‌ایِ ما و ولیدیتورهای سفارشی، `detail` رشته‌ایِ فارسی برمی‌گردانند.
 * - خطاهای ولیدیشنِ پیش‌فرضِ FastAPI، `detail` آرایه‌ای `[{loc,msg,...}]` است →
 *   اولین پیام + محل را نشان می‌دهیم.
 * اگر چیزی پیدا نشد، `fallback` استفاده می‌شود.
 */
export function apiErrorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { status?: number; data?: { detail?: unknown } } };
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string; loc?: (string | number)[] };
    if (first?.msg) {
      const field = Array.isArray(first.loc) ? first.loc.slice(1).join("·") : "";
      return field ? `${first.msg} (${field})` : first.msg;
    }
  }
  if (err?.response?.status === 429) return "تعداد درخواست‌ها زیاد شد؛ چند لحظه صبر کن.";
  return fallback;
}

// در حالت دمویِ اجباری، درخواست‌های GET مستقیماً داده‌ی نمونه می‌گیرند.
api.interceptors.request.use((config) => {
  if (DEMO_FORCED && (config.method ?? "get").toLowerCase() === "get") {
    const demo = demoFor(config.url);
    if (demo !== undefined) {
      // لغو درخواست واقعی و بازگرداندن داده‌ی دمو از طریق adapter
      config.adapter = async () => ({
        data: demo,
        status: 200,
        statusText: "OK (demo)",
        headers: {},
        config,
      });
    }
  }
  return config;
});

// تزریق access token از localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// تمدید خودکار توکن در صورت 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // اگر بک‌اند در دسترس نبود (بدون پاسخ) و داده‌ی دمو داریم، آن را برگردان.
    if (!error.response) {
      const demo = demoFor(error.config?.url);
      if (demo !== undefined) {
        return { data: demo, status: 200, statusText: "OK (demo)", headers: {},
          config: error.config };
      }
    }
    if (error.response?.status === 401 && typeof window !== "undefined") {
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/api/v1/auth/refresh`, {
            refresh_token: refresh,
          });
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          error.config.headers.Authorization = `Bearer ${data.access_token}`;
          return api.request(error.config);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);
