"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Phone, Bot, Menu, X } from "lucide-react";

const items = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/students", label: "دانشجویان / سرنخ‌ها", icon: Users },
  { href: "/calls", label: "تماس‌ها", icon: Phone },
  { href: "/assistant", label: "دستیار هوشمند", icon: Bot },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
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
        {items.map(({ href, label, icon: Icon }) => {
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
      <div className="mt-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-400">
        نسخه ۱.۰ — قدرت‌گرفته از هوش مصنوعی
      </div>
    </>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

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
    </>
  );
}
