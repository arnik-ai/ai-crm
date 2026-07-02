"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, Phone, Bot, BarChart3, ShoppingCart, ListTodo, UserCog, ClipboardList, ShieldCheck, Menu, X, LogOut } from "lucide-react";
import { getSession, isManager, isAuthenticated, logout, type SessionInfo } from "@/lib/auth";

// managerOnly: فقط مدیر فروش/ادمین می‌بیند (پنل مدیر فروش).
const items = [
  { href: "/tasks", label: "کارهای روز", icon: ClipboardList, managerOnly: false },
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard, managerOnly: true },
  { href: "/students", label: "دانشجویان / سرنخ‌ها", icon: Users, managerOnly: false },
  { href: "/calls", label: "تماس‌ها", icon: Phone, managerOnly: false },
  { href: "/sales", label: "لیست فروش", icon: ShoppingCart, managerOnly: false },
  { href: "/followups", label: "پیگیری‌ها", icon: ListTodo, managerOnly: false },
  { href: "/reports", label: "گزارش‌ها (پنل مدیر)", icon: BarChart3, managerOnly: true },
  { href: "/users", label: "مدیریت کاربران", icon: UserCog, managerOnly: true },
  { href: "/assistant", label: "دستیار هوشمند", icon: Bot, managerOnly: false },
  { href: "/guide", label: "راهنمای دسترسی‌ها", icon: ShieldCheck, managerOnly: false },
];

// آیتم‌های پرکاربردِ نوارِ پایینِ موبایل (دسترسی یک‌لمسی برای همه‌ی نقش‌ها)
const bottomItems = [
  { href: "/tasks", label: "کارها", icon: ClipboardList },
  { href: "/calls", label: "تماس‌ها", icon: Phone },
  { href: "/students", label: "سرنخ‌ها", icon: Users },
  { href: "/sales", label: "فروش", icon: ShoppingCart },
  { href: "/followups", label: "پیگیری", icon: ListTodo },
];

function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {bottomItems.map(({ href, label, icon: Icon }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
              active ? "text-blue-600" : "text-slate-500"
            }`}
          >
            <Icon size={20} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const router = useRouter();
  // نشستِ کاربر را پس از mount می‌خوانیم تا hydration سمت سرور/کلاینت یکسان بماند.
  const [session, setSession] = useState<SessionInfo | null>(null);
  useEffect(() => {
    setSession(getSession());
  }, []);

  const manager = session ? isManager(session) : false;
  const visibleItems = items.filter((it) => !it.managerOnly || manager);

  function handleLogout() {
    logout();
    onNavigate?.();
    router.replace("/login");
  }

  return (
    <>
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 font-extrabold text-white shadow-md shadow-blue-200">
          C
        </div>
        <span className="bg-gradient-to-l from-blue-600 to-indigo-600 bg-clip-text text-lg font-extrabold text-transparent">
          CRM هوشمند
        </span>
      </div>
      <nav className="space-y-1">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? "bg-gradient-to-l from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-200"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2 pt-4">
        {/* کاربرِ واردشده */}
        {session && !session.isDemo && (session.full_name || session.email) && (
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="truncate text-sm font-bold text-slate-700">
              {session.full_name || "کاربر"}
            </div>
            {session.email && (
              <div className="truncate text-xs text-slate-400" dir="ltr">{session.email}</div>
            )}
          </div>
        )}
        {/* خروج از حساب — توکن‌ها و نشست کامل پاک می‌شود */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
        >
          <LogOut size={18} /> خروج از حساب
        </button>
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400">
          نسخه ۱.۰ — قدرت‌گرفته از هوش مصنوعی
        </div>
      </div>
    </>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // نگهبان احراز هویت: همه‌ی صفحات محافظت‌شده Sidebar را رندر می‌کنند؛ پس اینجا
  // یک‌جا چک می‌کنیم. در حالت دمو، isAuthenticated همیشه true است (بدون ریدایرکت).
  useEffect(() => {
    if (!isAuthenticated()) router.replace("/login");
  }, [router]);

  return (
    <>
      {/* نوار بالای موبایل با دکمه‌ی همبرگری — فقط زیر breakpoint مدیوم دیده می‌شود */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          aria-label="باز کردن منو"
        >
          <Menu size={22} />
        </button>
        <span className="bg-gradient-to-l from-blue-600 to-indigo-600 bg-clip-text font-extrabold text-transparent">
          CRM هوشمند
        </span>
      </div>

      {/* Sidebar دسکتاپ — همیشه ثابت */}
      <aside className="hidden w-64 shrink-0 flex-col border-l border-slate-200 bg-white p-4 md:flex">
        <NavContent />
      </aside>

      {/* کشوی موبایل + پشت‌زمینه‌ی تیره */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-64 flex-col border-l border-slate-200 bg-white p-4 shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute left-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="بستن منو"
            >
              <X size={20} />
            </button>
            <NavContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* نوار ناوبریِ پایینِ موبایل — دسترسیِ سریع به صفحات پرکاربرد */}
      <BottomNav />
    </>
  );
}
