"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Phone, Bot } from "lucide-react";

const items = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/students", label: "دانشجویان / سرنخ‌ها", icon: Users },
  { href: "/calls", label: "تماس‌ها", icon: Phone },
  { href: "/assistant", label: "دستیار هوشمند", icon: Bot },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-slate-200 bg-white p-4">
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
    </aside>
  );
}
