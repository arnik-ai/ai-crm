"use client";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { Pagination } from "@/components/Pagination";
import { ExportButton } from "@/components/ExportButton";
import { ExportAllButton } from "@/components/ExportAllButton";
import type { ExcelColumn } from "@/lib/exportExcel";
import { isDemoMode } from "@/lib/auth";
import { faNum, faDateTime, faDigits } from "@/lib/utils";
import { Search, ShoppingCart, Receipt, Wallet, CreditCard, CalendarRange, Plus, X, Loader2 } from "lucide-react";

const DEMO = isDemoMode();
const PROGRAM = "برنامه";

/** نمایش تاریخ: ISO (بک واقعی) → فارسی خوانا؛ شمسیِ رشته‌ای (دمو) → همان. */
function showDate(s?: string | null): string {
  if (!s) return "—";
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? faDateTime(s) : s;
}

type Sale = {
  id: string;
  student_name: string | null;
  mobile: string | null;
  date: string;
  product: string | null;
  program_months: number | null;
  amount: number;
  payment: string | null;
  payment_ref: string | null;
  renewal_due: string | null;
};

type SalesResponse = {
  items: Sale[];
  total_amount: number;
  total_program?: number;
  total_other?: number;
  count: number;
  page?: number;
  size?: number;
};

type SalesMeta = {
  products: string[];
  payment_methods: string[];
  program_months: number[];
};

const PAGE_SIZE = 20;

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
  const m = Math.round((n / 1_000_000) * 10) / 10;
  return `${faNum(m)} م تومان`;
}

const FILTERS = ["همه", "کارت به کارت", "اقساط", "درگاه آنلاین"];

const EXCEL_COLUMNS: ExcelColumn<Sale>[] = [
  { key: "student_name", label: "نام مشتری" },
  { key: "mobile", label: "موبایل" },
  { key: "date", label: "تاریخ", format: (s) => showDate(s.date) },
  { key: "product", label: "محصول" },
  { key: "program_months", label: "مدت (ماه)", format: (s) => s.program_months ?? "" },
  { key: "amount", label: "مبلغ (تومان)", format: (s) => s.amount ?? 0 },
  { key: "payment", label: "نوع پرداخت" },
  { key: "payment_ref", label: "جزئیات واریز" },
];

export default function SalesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data } = useQuery<SalesResponse>({
    queryKey: ["sales", page],
    queryFn: async () =>
      (await api.get(`/sales?page=${page}&size=${PAGE_SIZE}`)).data,
    placeholderData: (prev) => prev,
  });

  const [q, setQ] = useState("");
  const [payment, setPayment] = useState("همه");
  const [showAdd, setShowAdd] = useState(false);

  const items: Sale[] = useMemo(() => {
    let list: Sale[] = data?.items ?? [];
    if (payment !== "همه") list = list.filter((s) => s.payment === payment);
    if (q.trim()) {
      const k = q.trim();
      list = list.filter(
        (s) =>
          (s.student_name ?? "").includes(k) ||
          (s.mobile ?? "").includes(k) ||
          (s.product ?? "").includes(k)
      );
    }
    return list;
  }, [data, q, payment]);

  const totalAmount = data?.total_amount ?? 0;
  const totalProgram = data?.total_program ?? 0;
  const totalOther = data?.total_other ?? 0;
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
            >
              <Plus size={16} /> ثبت فیش
            </button>
            <ExportButton rows={items} columns={EXCEL_COLUMNS} filename="لیست-فروش" />
            <ExportAllButton endpoint="/sales/export" filename="همه-فروش" />
            <BackButton dark />
          </div>
        </div>

        {/* کارت‌های خلاصه */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <Wallet className="text-emerald-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{amountMillions(totalAmount)}</div>
              <div className="text-xs text-slate-500">مجموع کل فروش</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
            <CalendarRange className="text-indigo-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{amountMillions(totalProgram)}</div>
              <div className="text-xs text-slate-500">جمع فروش برنامه</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
            <CreditCard className="text-violet-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{amountMillions(totalOther)}</div>
              <div className="text-xs text-slate-500">جمع فروش دوره</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <Receipt className="text-blue-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{faNum(count)}</div>
              <div className="text-xs text-slate-500">تعداد فروش</div>
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
              placeholder="جستجوی نام، موبایل یا محصول…"
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
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gradient-to-l from-emerald-50 to-green-50 text-slate-600">
              <tr>
                <th className="p-3.5 text-right font-medium">دانشجو</th>
                <th className="p-3.5 text-right font-medium">تاریخ</th>
                <th className="p-3.5 text-right font-medium">محصول</th>
                <th className="p-3.5 text-center font-medium">مدت</th>
                <th className="p-3.5 text-center font-medium">مبلغ</th>
                <th className="p-3.5 text-right font-medium">نوع پرداخت</th>
                <th className="p-3.5 text-right font-medium">جزئیات واریز</th>
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
                  <td className="p-3.5 text-slate-600">{showDate(s.date)}</td>
                  <td className="p-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      s.product === PROGRAM ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {s.product ?? "—"}
                    </span>
                  </td>
                  <td className="p-3.5 text-center text-slate-600">
                    {s.program_months ? `${faNum(s.program_months)} ماه` : "—"}
                  </td>
                  <td className="p-3.5 text-center font-extrabold text-emerald-600">
                    {amountMillions(s.amount)}
                  </td>
                  <td className="p-3.5"><PaymentBadge payment={s.payment} /></td>
                  <td className="p-3.5 text-slate-500" dir="ltr">{s.payment_ref ? faDigits(s.payment_ref) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <ShoppingCart size={40} className="opacity-40" />
              <p className="text-sm">فروشی مطابق جستجوی شما یافت نشد.</p>
            </div>
          )}
        </div>

        {q.trim() === "" && payment === "همه" && (
          <Pagination
            page={data?.page ?? page}
            size={data?.size ?? PAGE_SIZE}
            total={count}
            onPage={setPage}
          />
        )}
      </main>

      {showAdd && (
        <AddSaleModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ["sales"] }); }}
        />
      )}
    </div>
  );
}

/* ---------- مودال ثبت فیش ---------- */
function AddSaleModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { data: meta } = useQuery<SalesMeta>({
    queryKey: ["sales-meta"],
    queryFn: async () => (await api.get("/sales/meta")).data,
  });

  const [studentName, setStudentName] = useState("");
  const [mobile, setMobile] = useState("");
  const [product, setProduct] = useState("");
  const [months, setMonths] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isProgram = product === PROGRAM;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (isProgram && !months) {
      setError("برای «برنامه»، مدت (ماه) را انتخاب کنید.");
      return;
    }
    setLoading(true);
    try {
      if (DEMO) {
        alert("در حالت نمایشی، ثبت فیش ذخیره نمی‌شود.");
        onClose();
        return;
      }
      await api.post("/sales", {
        student_name: studentName,
        mobile,
        product,
        program_months: isProgram ? months : null,
        amount: Number(amount) || 0,
        payment_method: paymentMethod || null,
        payment_ref: paymentRef || null,
      });
      onAdded();
    } catch {
      setError("ثبت فیش ناموفق بود. ورودی‌ها را بررسی کنید.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">ثبت فیش فروش</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            placeholder="نام مشتری"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            required
          />
          <input
            type="tel"
            placeholder="موبایل (مثلاً ۰۹۱۲۳۴۵۶۷۸۹)"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            dir="ltr"
            required
          />
          {/* کشوی محصول */}
          <select
            value={product}
            onChange={(e) => { setProduct(e.target.value); setMonths(""); }}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            required
          >
            <option value="" disabled>انتخاب محصول…</option>
            {(meta?.products ?? []).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {/* کشوی مدت — فقط برای برنامه */}
          {isProgram && (
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="w-full rounded-xl border border-indigo-300 bg-indigo-50/40 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              required
            >
              <option value="" disabled>مدت برنامه…</option>
              {(meta?.program_months ?? []).map((m) => (
                <option key={m} value={m}>{faNum(m)} ماه</option>
              ))}
            </select>
          )}
          <input
            type="number"
            placeholder="مبلغ (تومان)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            dir="ltr"
            min={0}
            required
          />
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">نوع پرداخت…</option>
            {(meta?.payment_methods ?? []).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            placeholder="جزئیات واریز (کد رهگیری/کارت) — اختیاری"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            dir="ltr"
          />
          {error && <div className="text-sm text-rose-600">{error}</div>}
          <button
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            ثبت فیش
          </button>
        </form>
      </div>
    </div>
  );
}
