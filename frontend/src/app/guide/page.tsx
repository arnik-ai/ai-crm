"use client";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { getSession } from "@/lib/auth";
import { ShieldCheck, Crown, UserCog, Headset, Eye, Check, X as XIcon } from "lucide-react";

// نقش‌ها و توانایی‌هایشان — هم‌خوان با seed.py (ROLE_PERMS).
const ROLES = [
  {
    key: "admin",
    label: "ادمین",
    icon: Crown,
    tone: "from-amber-500 to-orange-500",
    desc: "دسترسیِ کامل به همه‌ی بخش‌ها و تنظیمات.",
    can: ["همه‌ی قابلیت‌ها", "مدیریت کاربران و نقش‌ها", "همه‌ی گزارش‌ها و داشبورد"],
    cannot: [],
  },
  {
    key: "sales_manager",
    label: "مدیر فروش",
    icon: UserCog,
    tone: "from-indigo-500 to-blue-500",
    desc: "دیدِ کاملِ تیم + مدیریت.",
    can: [
      "دیدنِ همه‌ی دانشجویان و تماس‌ها",
      "داشبورد و گزارش‌های مدیریتی",
      "مدیریت کاربران (افزودن/ویرایش)",
      "تخصیصِ مشاور به دانشجو",
      "ثبت فروش/فیش و اقساط",
    ],
    cannot: ["تنظیماتِ سیستمیِ ادمین"],
  },
  {
    key: "sales_agent",
    label: "کارشناس فروش (مشاور)",
    icon: Headset,
    tone: "from-emerald-500 to-green-600",
    desc: "کارِ روزمره روی سرنخ‌های خودش.",
    can: [
      "دیدنِ فقط دانشجویانِ تخصیص‌یافته به خودش",
      "ثبت تماس، نتیجه و پیگیری",
      "ثبت فیش فروش و خرید",
      "تکمیل/ویرایشِ اطلاعاتِ دانشجو",
    ],
    cannot: [
      "دیدنِ دانشجویانِ سایر مشاوران",
      "گزارش‌های مدیریتی و داشبورد",
      "مدیریت کاربران و تخصیصِ مشاور",
    ],
  },
  {
    key: "viewer",
    label: "بیننده",
    icon: Eye,
    tone: "from-slate-400 to-slate-500",
    desc: "فقط مشاهده، بدون تغییر.",
    can: ["مشاهده‌ی دانشجویان و تماس‌ها", "مشاهده‌ی داشبورد"],
    cannot: ["هرگونه ثبت یا ویرایش"],
  },
];

const ROLE_FA: Record<string, string> = {
  admin: "ادمین",
  sales_manager: "مدیر فروش",
  sales_agent: "کارشناس فروش (مشاور)",
  viewer: "بیننده",
};

// ماتریسِ دسترسیِ صفحه‌ها به نقش‌ها (هم‌خوان با مجوزهای seed.py)
// ترتیب ستون‌ها: admin, sales_manager, sales_agent, viewer
const ACCESS_COLS = ["admin", "sales_manager", "sales_agent", "viewer"] as const;
const ACCESS_ROWS: { page: string; access: boolean[]; note?: string }[] = [
  { page: "کارهای روز", access: [true, true, true, true] },
  { page: "دانشجویان / سرنخ‌ها", access: [true, true, true, true], note: "کارشناس فقط مالِ خودش" },
  { page: "تماس‌ها", access: [true, true, true, true], note: "بیننده فقط مشاهده" },
  { page: "لیست فروش و اقساط", access: [true, true, true, false] },
  { page: "پیگیری‌ها", access: [true, true, true, false] },
  { page: "دستیار هوشمند", access: [true, true, true, false] },
  { page: "داشبورد", access: [true, true, false, true], note: "بیننده فقط مشاهده" },
  { page: "گزارش‌های مدیریتی", access: [true, true, false, false] },
  { page: "مدیریت کاربران", access: [true, true, false, false] },
];

export default function GuidePage() {
  const [roles, setRoles] = useState<string[]>([]);
  const [name, setName] = useState("");
  useEffect(() => {
    const s = getSession();
    setRoles(s.roles);
    setName(s.full_name);
  }, []);

  const myRole = roles[0];

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        {/* سرتیتر */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-200">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">راهنمای نقش‌ها و دسترسی‌ها</h1>
              <p className="mt-0.5 text-sm text-slate-300">هر نقش به چه چیزهایی دسترسی دارد</p>
            </div>
          </div>
          <BackButton dark />
        </div>

        {/* نقشِ کاربرِ فعلی */}
        <div className="mb-5 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">نقشِ شما:</span>
            <span className="rounded-full bg-violet-100 px-3 py-1 font-bold text-violet-700">
              {myRole ? ROLE_FA[myRole] ?? myRole : "—"}
            </span>
            {name && <span className="text-slate-400">· {name}</span>}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            «مشاور» در این سیستم همان <b>کارشناس فروش</b> است — کاربری که دانشجو به او تخصیص داده می‌شود.
          </p>
        </div>

        {/* کارت‌های نقش */}
        <div className="grid gap-4 md:grid-cols-2">
          {ROLES.map((r) => {
            const mine = r.key === myRole;
            const Icon = r.icon;
            return (
              <div
                key={r.key}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  mine ? "border-violet-300 ring-2 ring-violet-100" : "border-slate-100"
                }`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${r.tone} text-white`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      {r.label}
                      {mine && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                          نقشِ شما
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">{r.desc}</div>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {r.can.map((c, i) => (
                    <li key={`c${i}`} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check size={16} className="mt-0.5 shrink-0 text-emerald-500" /> {c}
                    </li>
                  ))}
                  {r.cannot.map((c, i) => (
                    <li key={`x${i}`} className="flex items-start gap-2 text-sm text-slate-400">
                      <XIcon size={16} className="mt-0.5 shrink-0 text-rose-400" /> {c}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* جدولِ دسترسیِ صفحه‌ها به نقش‌ها */}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <span className="font-bold text-slate-800">کدام صفحه برای کدام نقش؟</span>
          </div>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3 text-right font-medium">صفحه</th>
                {ACCESS_COLS.map((c) => (
                  <th key={c} className={`p-3 text-center font-medium ${c === myRole ? "text-violet-700" : ""}`}>
                    {ROLE_FA[c]}
                    {c === myRole && <span className="block text-[10px]">(شما)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACCESS_ROWS.map((row, i) => (
                <tr key={row.page} className={`border-t border-slate-100 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
                  <td className="p-3 text-slate-700">
                    {row.page}
                    {row.note && <span className="mr-1 text-[11px] text-slate-400"> · {row.note}</span>}
                  </td>
                  {row.access.map((ok, k) => (
                    <td key={k} className={`p-3 text-center ${ACCESS_COLS[k] === myRole ? "bg-violet-50/50" : ""}`}>
                      {ok ? <Check size={16} className="mx-auto text-emerald-500" />
                          : <XIcon size={16} className="mx-auto text-rose-300" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          تصمیمِ نهاییِ دسترسی همیشه در سرور گرفته می‌شود؛ این صفحه فقط راهنماست.
        </p>
      </main>
    </div>
  );
}
