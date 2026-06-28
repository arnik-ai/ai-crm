"use client";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { Pagination } from "@/components/Pagination";
import { ExportButton } from "@/components/ExportButton";
import { ExportAllButton } from "@/components/ExportAllButton";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import type { ExcelColumn } from "@/lib/exportExcel";
import { isDemoMode } from "@/lib/auth";
import { faNum, faDateTime, faDigits } from "@/lib/utils";
import { Search, ShoppingCart, Receipt, CreditCard, CalendarRange, Plus, X, Loader2, Trash2 } from "lucide-react";

const DEMO = isDemoMode();
const PROGRAM = "برنامه";

/** نمایش تاریخ: ISO (بک واقعی) → فارسی خوانا؛ شمسیِ رشته‌ای (دمو) → همان. */
function showDate(s?: string | null): string {
  if (!s) return "—";
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? faDateTime(s) : s;
}

type SaleItem = {
  product: string;
  program_months: number | null;
  amount: number;
};

type Sale = {
  id: string;
  student_name: string | null;
  mobile: string | null;
  date: string;
  product: string | null;       // خلاصه (تک‌محصولی=نام، چندمحصولی=«چند محصول»)
  program_months: number | null;
  amount: number;               // جمع کل فیش
  items: SaleItem[];
  payment_ref: string | null;
  deposited_at: string | null;
  payer_card: string | null;
  dest_account: string | null;
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
  accounts: string[];
  program_months: number[];
};

const PAGE_SIZE = 20;

/** فرمت مبلغ تومان (نمایش به میلیون برای خوانایی). */
function amountMillions(n: number): string {
  const m = Math.round((n / 1_000_000) * 10) / 10;
  return `${faNum(m)} م تومان`;
}

/** خلاصه‌ی نام محصولاتِ یک فیش (برای جستجو/خروجی). */
function productsText(s: Sale): string {
  if (s.items?.length) return s.items.map((it) => it.product).join("، ");
  return s.product ?? "";
}

const EXCEL_COLUMNS: ExcelColumn<Sale>[] = [
  { key: "student_name", label: "نام مشتری" },
  { key: "mobile", label: "موبایل" },
  { key: "date", label: "تاریخ", format: (s) => showDate(s.date) },
  { key: "product", label: "محصول", format: (s) => productsText(s) },
  { key: "amount", label: "مبلغ کل (تومان)", format: (s) => s.amount ?? 0 },
  { key: "payer_card", label: "کارت واریزکننده" },
  { key: "dest_account", label: "بانک مقصد" },
  { key: "deposited_at", label: "تاریخ واریز", format: (s) => showDate(s.deposited_at) },
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
  const [showAdd, setShowAdd] = useState(false);

  const items: Sale[] = useMemo(() => {
    let list: Sale[] = data?.items ?? [];
    if (q.trim()) {
      const k = q.trim();
      list = list.filter(
        (s) =>
          (s.student_name ?? "").includes(k) ||
          (s.mobile ?? "").includes(k) ||
          productsText(s).includes(k)
      );
    }
    return list;
  }, [data, q]);

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

        {/* کارت‌های خلاصه — جمعِ هر دسته جدا (بدون مجموع کل) */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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

        {/* نوار جستجو */}
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
        </div>

        {/* جدول فروش */}
        <div className="overflow-x-auto rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-gradient-to-l from-emerald-50 to-green-50 text-slate-600">
              <tr>
                <th className="p-3.5 text-right font-medium">دانشجو</th>
                <th className="p-3.5 text-right font-medium">تاریخ</th>
                <th className="p-3.5 text-right font-medium">محصول(ها)</th>
                <th className="p-3.5 text-center font-medium">مبلغ کل</th>
                <th className="p-3.5 text-right font-medium">کارت واریزکننده</th>
                <th className="p-3.5 text-right font-medium">بانک مقصد</th>
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
                  <td className="p-3.5 align-top">
                    <div className="font-medium text-slate-700">{s.student_name ?? "—"}</div>
                    <div className="text-xs text-slate-400" dir="ltr">{s.mobile || "—"}</div>
                  </td>
                  <td className="p-3.5 align-top text-slate-600">
                    {showDate(s.date)}
                    {s.deposited_at && (
                      <div className="text-[11px] text-slate-400">واریز: {showDate(s.deposited_at)}</div>
                    )}
                  </td>
                  <td className="p-3.5 align-top">
                    <div className="flex flex-col gap-1">
                      {(s.items?.length ? s.items : [{ product: s.product ?? "—", program_months: s.program_months, amount: s.amount }]).map((it, k) => (
                        <div key={k} className="flex items-center gap-2">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            it.product === PROGRAM ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
                          }`}>
                            {it.product}{it.program_months ? ` · ${faNum(it.program_months)} ماه` : ""}
                          </span>
                          <span className="text-xs text-slate-400">{amountMillions(it.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="p-3.5 align-top text-center font-extrabold text-emerald-600">
                    {amountMillions(s.amount)}
                  </td>
                  <td className="p-3.5 align-top text-slate-500" dir="ltr">{s.payer_card ? faDigits(s.payer_card) : "—"}</td>
                  <td className="p-3.5 align-top text-slate-600">{s.dest_account ?? "—"}</td>
                  <td className="p-3.5 align-top text-slate-500" dir="ltr">{s.payment_ref ? faDigits(s.payment_ref) : "—"}</td>
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

        {q.trim() === "" && (
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

/* ---------- مودال ثبت فیش (چندمحصولی + اسناد واریز) ---------- */
type ItemRow = { product: string; months: number | ""; amount: string };

function AddSaleModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { data: meta } = useQuery<SalesMeta>({
    queryKey: ["sales-meta"],
    queryFn: async () => (await api.get("/sales/meta")).data,
  });

  const [studentName, setStudentName] = useState("");
  const [mobile, setMobile] = useState("");
  const [saleDate, setSaleDate] = useState(""); // تاریخ فروش (ISO میلادی از پیکر شمسی)
  const [rows, setRows] = useState<ItemRow[]>([{ product: "", months: "", amount: "" }]);
  const [depDate, setDepDate] = useState(""); // ISO میلادی از پیکر شمسی
  const [depTime, setDepTime] = useState(""); // HH:MM
  const [payerCard, setPayerCard] = useState("");
  const [destAccount, setDestAccount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function setRow(i: number, patch: Partial<ItemRow>) {
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, { product: "", months: "", amount: "" }]);
  }
  function removeRow(i: number) {
    setRows((rs) => (rs.length > 1 ? rs.filter((_, k) => k !== i) : rs));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // اعتبارسنجی هر ردیفِ محصول
    for (const r of rows) {
      if (!r.product) { setError("محصولِ هر ردیف را انتخاب کنید."); return; }
      if (r.product === PROGRAM && !r.months) { setError("برای «برنامه»، مدت (ماه) را انتخاب کنید."); return; }
      if (!r.amount || Number(r.amount) <= 0) { setError("مبلغِ هر محصول را وارد کنید."); return; }
    }
    setLoading(true);
    try {
      if (DEMO) {
        alert("در حالت نمایشی، ثبت فیش ذخیره نمی‌شود.");
        onClose();
        return;
      }
      const depositedAt = depDate
        ? new Date(`${depDate}T${depTime || "00:00"}`).toISOString()
        : null;
      await api.post("/sales", {
        student_name: studentName,
        mobile,
        // ساعت ۱۲ ظهر تا با جابه‌جاییِ منطقه‌ی زمانی، روزِ فروش تغییر نکند
        sold_at: saleDate ? new Date(`${saleDate}T12:00`).toISOString() : null,
        items: rows.map((r) => ({
          product: r.product,
          program_months: r.product === PROGRAM ? r.months : null,
          amount: Number(r.amount) || 0,
        })),
        deposited_at: depositedAt,
        payer_card: payerCard || null,
        dest_account: destAccount || null,
        payment_ref: paymentRef || null,
      });
      onAdded();
    } catch {
      setError("ثبت فیش ناموفق بود. ورودی‌ها را بررسی کنید.");
    } finally {
      setLoading(false);
    }
  }

  const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">ثبت فیش فروش</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {/* مشخصات مشتری */}
          <input
            placeholder="نام و نام خانوادگی"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            required
          />
          <input
            type="tel"
            placeholder="شماره تلفن (مثلاً ۰۹۱۲۳۴۵۶۷۸۹)"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            dir="ltr"
            required
          />
          {/* تاریخ فروش (اختیاری — خالی = امروز) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">تاریخ فروش:</span>
            <JalaliDatePicker value={saleDate} onChange={setSaleDate} placeholder="امروز" />
          </div>

          {/* محصولات (چندتایی — هرکدام با مبلغ خودش) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">محصولات خریداری‌شده</span>
              <button type="button" onClick={addRow}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-700">
                <Plus size={14} /> افزودن محصول
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-white p-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={r.product}
                      onChange={(e) => setRow(i, { product: e.target.value, months: "" })}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-emerald-400"
                      required
                    >
                      <option value="" disabled>انتخاب محصول…</option>
                      {(meta?.products ?? []).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="مبلغ (تومان)"
                      value={r.amount}
                      onChange={(e) => setRow(i, { amount: e.target.value })}
                      className="w-32 rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-emerald-400"
                      dir="ltr"
                      min={0}
                      required
                    />
                    {rows.length > 1 && (
                      <button type="button" onClick={() => removeRow(i)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  {/* مدت — فقط برای «برنامه» */}
                  {r.product === PROGRAM && (
                    <select
                      value={r.months}
                      onChange={(e) => setRow(i, { months: Number(e.target.value) })}
                      className="mt-2 w-full rounded-lg border border-indigo-300 bg-indigo-50/40 px-2 py-2 text-sm outline-none focus:border-indigo-400"
                      required
                    >
                      <option value="" disabled>مدت برنامه…</option>
                      {(meta?.program_months ?? []).map((m) => (
                        <option key={m} value={m}>{faNum(m)} ماه</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 text-left text-xs font-medium text-emerald-700">
              جمع کل: {amountMillions(total)}
            </div>
          </div>

          {/* اسناد واریز */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-2 text-sm font-medium text-slate-700">اسناد واریز</div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">تاریخ و ساعت واریز:</span>
                <JalaliDatePicker value={depDate} onChange={setDepDate} placeholder="تاریخ (شمسی)" />
                <input
                  type="time"
                  value={depTime}
                  onChange={(e) => setDepTime(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-400"
                  dir="ltr"
                />
              </div>
              <input
                placeholder="کارت واریزکننده"
                value={payerCard}
                onChange={(e) => setPayerCard(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                dir="ltr"
              />
              <select
                value={destAccount}
                onChange={(e) => setDestAccount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
              >
                <option value="">بانک مقصد (حساب ما)…</option>
                {(meta?.accounts ?? []).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <input
                placeholder="جزئیات واریز (کد رهگیری) — اختیاری"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                dir="ltr"
              />
            </div>
          </div>

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
