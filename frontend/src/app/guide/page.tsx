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
      </main>
    </div>
  );
}
