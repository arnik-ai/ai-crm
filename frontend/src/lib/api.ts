import axios from "axios";
import { demoByPath } from "./demoData";

// حالت دمو: اگر NEXT_PUBLIC_DEMO=1 باشد یا بک‌اند در دسترس نباشد،
// داده‌ی نمونه نمایش داده می‌شود (برای دیدن ظاهر بدون دیتابیس).
const DEMO_FORCED = process.env.NEXT_PUBLIC_DEMO === "1";

function demoFor(url?: string) {
  if (!url) return undefined;
  const path = url.replace(/^\/api\/v1/, "").split("?")[0];
  return demoByPath[path];
}

export const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

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
          const { data } = await axios.post("/api/v1/auth/refresh", {
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
