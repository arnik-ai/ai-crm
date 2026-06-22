"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { faNum, faDateTime } from "@/lib/utils";
import { Search, ShoppingCart, Receipt, Wallet, CreditCard } from "lucide-react";

/** نمایش تاریخ: ISO (بک واقعی) → فارسی خوانا؛ شمسیِ رشته‌ای (دمو) → همان. */
function showDate(s?: string): string {
  if (!s) return "—";
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? faDateTime(s) : s;
}

type Sale = {
  id: string;
  student_name: string | null;
  mobile: string | null;
  date: string;
  course: string | null;
  product: string | null;
  amount: number;
  payment: string | null;
};

type SalesResponse = {
  items: Sale[];
  total_amount: number;
  count: number;
};

/** نشان رنگی نوع پرداخت. */
function PaymentBadge({ payment }: { payment?: string | null }) {
  if (!payment) return <span className="text-slate-300">—</span>;
  const tone: Record<string, string> = {
    "کارت به کارت": "bg-blue-50 text-blue-600",
    "اقساط": "bg-amber-50 text-amber-600",
    "درگاه آنلاین": "bg-emerald-50 text-emerald-600",
    "نقدی": "bg-violet-50 text-violet-600",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone[payment] ?? "bg-slate-100 text-slate-600"}`}>
      {payment}
    </span>
  );
}

/** فرمت مبلغ تومان (نمایش به میلیون برای خوانایی). */
function amountMillions(n: number): string {
  const m = Math.round((n / 1_000_000) * 10) / 10; // یک رقم اعشار
  return `${faNum(m)} م تومان`;
}

const FILTERS = ["همه", "کارت به کارت", "اقساط", "درگاه آنلاین"];

export default function SalesPage() {
  const { data } = useQuery<SalesResponse>({
    queryKey: ["sales"],
    queryFn: async () => (await api.get("/sales")).data,
  });

  const [q, setQ] = useState("");
  const [payment, setPayment] = useState("همه");

  const items: Sale[] = useMemo(() => {
    let list: Sale[] = data?.items ?? [];
    if (payment !== "همه") list = list.filter((s) => s.payment === payment);
    if (q.trim()) {
      const k = q.trim();
      list = list.filter(
        (s) =>
          (s.student_name ?? "").includes(k) ||
          (s.mobile ?? "").includes(k) ||
          (s.course ?? "").includes(k)
      );
    }
    return list;
  }, [data, q, payment]);

  // مجموع مبلغ نمایش‌داده‌شده (پس از فیلتر)
  const shownAmount = items.reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const totalAmount = data?.total_amount ?? 0;
  const count = data?.count ?? items.length;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        {/* سرتیتر */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-200">
              <ShoppingCart size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">لیست فروش</h1>
              <p className="mt-0.5 text-sm text-slate-300">
                {faNum(items.length)} مورد · فروش ثبت‌شده
              </p>
            </div>
          </div>
          <BackButton dark />
        </div>

        {/* کارت‌های خلاصه */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <Wallet className="text-emerald-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{amountMillions(totalAmount)}</div>
              <div className="text-xs text-slate-500">مجموع فروش</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <Receipt className="text-blue-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{faNum(count)}</div>
              <div className="text-xs text-slate-500">تعداد فروش</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
            <CreditCard className="text-violet-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{amountMillions(shownAmount)}</div>
              <div className="text-xs text-slate-500">جمع نمایش‌داده‌شده</div>
            </div>
          </div>
        </div>

        {/* نوار جستجو و فیلتر */}
        <div className="panel-toolbar mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجوی نام، موبایل یا دوره…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setPayment(f)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  payment === f
                    ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* جدول فروش */}
        <div className="overflow-x-auto rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gradient-to-l from-emerald-50 to-green-50 text-slate-600">
              <tr>
                <th className="p-3.5 text-right font-medium">دانشجو</th>
                <th className="p-3.5 text-right font-medium">تاریخ</th>
                <th className="p-3.5 text-right font-medium">دوره</th>
                <th className="p-3.5 text-right font-medium">محصول</th>
                <th className="p-3.5 text-center font-medium">مبلغ</th>
                <th className="p-3.5 text-right font-medium">نوع پرداخت</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-t border-slate-100 transition hover:bg-emerald-50/60 ${
                    i % 2 === 1 ? "bg-slate-50/40" : ""
                  }`}
                >
                  <td className="p-3.5">
                    <div className="font-medium text-slate-700">{s.student_name ?? "—"}</div>
                    <div className="text-xs text-slate-400" dir="ltr">{s.mobile || "—"}</div>
                  </td>
                  <td className="p-3.5 text-slate-600" dir="ltr">{showDate(s.date)}</td>
                  <td className="p-3.5 text-slate-600">{s.course ?? "—"}</td>
                  <td className="p-3.5 text-slate-500">{s.product ?? "—"}</td>
                  <td className="p-3.5 text-center font-extrabold text-emerald-600">
                    {amountMillions(s.amount)}
                  </td>
                  <td className="p-3.5"><PaymentBadge payment={s.payment} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* حالت خالی */}
          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <ShoppingCart size={40} className="opacity-40" />
              <p className="text-sm">فروشی مطابق جستجوی شما یافت نشد.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
