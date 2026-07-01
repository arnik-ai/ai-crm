"use client";
/**
 * نقش‌ها و دسترسی کاربر — خواندن از توکن JWT.
 *
 * بک‌اند در access_token فیلدهای roles (مثل ["sales_manager"]) و
 * perms (مثل ["dashboard:read", ...]) را قرار می‌دهد. اینجا فقط توکن را
 * بدون اعتبارسنجی امضا decode می‌کنیم تا UI را بر اساس نقش تنظیم کنیم؛
 * تصمیم امنیتیِ واقعی همچنان در بک‌اند (require_permission) گرفته می‌شود.
 *
 * حالت دمو: چون توکن واقعی وجود ندارد، نقش پیش‌فرض «مدیر فروش» در نظر گرفته
 * می‌شود تا همه‌ی صفحات قابل نمایش باشند. برای تست نقش کارشناس، در localStorage
 * مقدار demo_role=sales_agent بگذار.
 */

export type SessionInfo = {
  roles: string[];
  perms: string[];
  email: string;
  full_name: string;
  isDemo: boolean;
};

const DEMO_FORCED = process.env.NEXT_PUBLIC_DEMO !== "0";

/** decode بخش payload یک JWT (بدون بررسی امضا). */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

/** اطلاعات نشست فعلی (نقش‌ها/مجوزها) را برمی‌گرداند. */
export function getSession(): SessionInfo {
  // پیش‌فرض امن برای رندر سمت سرور (SSR) — قبل از دسترسی به window.
  const empty: SessionInfo = {
    roles: [],
    perms: [],
    email: "",
    full_name: "",
    isDemo: false,
  };
  if (typeof window === "undefined") return empty;

  const token = localStorage.getItem("access_token");
  const claims = token ? decodeJwt(token) : null;

  if (claims) {
    return {
      roles: Array.isArray(claims.roles) ? (claims.roles as string[]) : [],
      perms: Array.isArray(claims.perms) ? (claims.perms as string[]) : [],
      email: typeof claims.email === "string" ? claims.email : "",
      full_name: typeof claims.full_name === "string" ? claims.full_name : "",
      isDemo: false,
    };
  }

  // حالت دمو: نقش از localStorage (پیش‌فرض مدیر فروش) تا UI کامل دیده شود.
  if (DEMO_FORCED) {
    const demoRole = localStorage.getItem("demo_role") || "sales_manager";
    return {
      roles: [demoRole],
      perms: demoRole === "sales_agent" ? ["students:read", "calls:read"] : ["dashboard:read"],
      email: "demo@crm.local",
      full_name: demoRole === "sales_agent" ? "کارشناس دمو" : "مدیر دمو",
      isDemo: true,
    };
  }

  return empty;
}

/** آیا حالت دمو فعال است؟ (در دمو نیازی به ورود نیست) */
export function isDemoMode(): boolean {
  return DEMO_FORCED;
}

/** خروج از حساب: پاک‌کردنِ کاملِ توکن‌ها و اطلاعاتِ نشست از مرورگر.
 *  بعد از این، getSession دیگر ایمیل/نقش ندارد و کاربر باید دوباره وارد شود. */
export function logout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("demo_role");
}

/** آیا کاربر واقعاً وارد شده (توکن معتبر دارد)؟ در حالت دمو همیشه true. */
export function isAuthenticated(): boolean {
  if (DEMO_FORCED) return true;
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("access_token");
}

/** آیا کاربر دسترسی مدیریتی دارد (مدیر فروش یا ادمین)؟ */
export function isManager(s: SessionInfo): boolean {
  return s.roles.includes("admin") || s.roles.includes("sales_manager");
}

/** آیا کاربر مجوز مشخصی دارد؟ (admin همیشه true) */
export function hasPerm(s: SessionInfo, perm: string): boolean {
  return s.roles.includes("admin") || s.perms.includes(perm);
}
