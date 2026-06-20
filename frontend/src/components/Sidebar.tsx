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
    <aside className="w-64 shrink-0 border-l border-slate-200 bg-white p-4">
      <div className="mb-8 px-2 text-lg font-bold text-brand">CRM هوشمند</div>
      <nav className="space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active ? "bg-brand text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
