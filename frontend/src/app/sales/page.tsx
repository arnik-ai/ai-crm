"use client";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { Pagination } from "@/components/Pagination";
import { ExportButton } from "@/components/ExportButton";
import { ExportAllButton } from "@/components/ExportAllButton";
import { JalaliDatePicker } from "@/components/JalaliDatePicker";
import { InstallmentsTab } from "@/components/InstallmentsTab";
import { useToast } from "@/components/Toast";
import type { ExcelColumn } from "@/lib/exportExcel";
import { isDemoMode } from "@/lib/auth";
import { faNum, faDateTime, faDigits, faDate } from "@/lib/utils";
import { Search, ShoppingCart, Receipt, CreditCard, CalendarRange, Plus, X, Loader2, Pencil, Trash2, ChevronDown } from "lucide-react";

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

type LookupResult = {
  exists: boolean;
  student_name?: string | null;
  created_at?: string | null;
  purchase_count?: number;
  purchases?: { product: string; amount: number; date: string | null }[];
};

const PAGE_SIZE = 20;

/** نمایش مبلغ به واحدِ «هزار تومان» (سه صفر آخر حذف می‌شود — مطابق روالِ کارفرما).
 *  مقدار در دیتابیس تومانِ کامل است؛ اینجا ÷۱۰۰۰ و با برچسبِ «هزار تومان» نشان داده می‌شود. */
function amountFa(toman: number): string {
  return `${faNum(Math.round((toman || 0) / 1000))} هزار تومان`;
}

/** عددِ واردشده در فرم (به «هزار تومان») → تومانِ کامل برای ذخیره. */
function thousandsToToman(entered: string | number): number {
  return (Number(entered) || 0) * 1000;
}

/** خلاصه‌ی نام محصولاتِ یک فیش (برای جستجو/خروجی). */
function productsText(s: Sale): string {
  if (s.items?.length) return s.items.map((it) => it.product).join("، ");
  return s.product ?? "";
}

/** تاریخِ امروز (ISO میلادی) و ساعتِ اکنون (HH:MM) — پیش‌فرضِ فرمِ فیش تا آنچه
 *  کاربر می‌بیند دقیقاً همان چیزی باشد که ذخیره می‌شود (نه پیش‌فرضِ نامرئیِ سرور). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nowHm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const EXCEL_COLUMNS: ExcelColumn<Sale>[] = [
  { key: "student_name", label: "نام مشتری" },
  { key: "mobile", label: "موبایل" },
  { key: "date", label: "تاریخ", format: (s) => showDate(s.date) },
  { key: "product", label: "محصول", format: (s) => productsText(s) },
  { key: "amount", label: "مبلغ کل (هزار تومان)", format: (s) => Math.round((s.amount ?? 0) / 1000) },
  { key: "payer_card", label: "کارت واریزکننده" },
  { key: "dest_account", label: "بانک مقصد" },
  { key: "deposited_at", label: "تاریخ واریز", format: (s) => showDate(s.deposited_at) },
  { key: "payment_ref", label: "جزئیات واریز" },
];

export default function SalesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  // فیلترِ بازه‌ی تاریخ (ISO میلادی از JalaliDatePicker) — هم برای بررسی، هم خروجی
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const dateQs =
    `${dateFrom ? `&date_from=${dateFrom}` : ""}${dateTo ? `&date_to=${dateTo}` : ""}`;
  const { data } = useQuery<SalesResponse>({
    queryKey: ["sales", page, dateFrom, dateTo],
    queryFn: async () =>
      (await api.get(`/sales?page=${page}&size=${PAGE_SIZE}${dateQs}`)).data,
    placeholderData: (prev) => prev,
  });

  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [tab, setTab] = useState<"sales" | "installments">("sales");

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
            {tab === "sales" && (
              <>
                <button
                  onClick={() => setShowAdd(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                >
                  <Plus size={16} /> ثبت فیش
                </button>
                <ExportButton rows={items} columns={EXCEL_COLUMNS} filename="لیست-فروش" />
                <ExportAllButton
                  endpoint={`/sales/export${dateFrom || dateTo ? `?${dateQs.replace(/^&/, "")}` : ""}`}
                  filename="همه-فروش"
                />
              </>
            )}
            <BackButton dark />
          </div>
        </div>

        {/* تب‌ها: فیش‌های فروش | اقساط برنامه‌ها */}
        <div className="mb-4 flex gap-2">
          {([
            { k: "sales", label: "فیش‌های فروش" },
            { k: "installments", label: "اقساط برنامه‌ها" },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                tab === t.k
                  ? "bg-white text-slate-800 shadow-sm"
                  : "bg-white/10 text-slate-200 hover:bg-white/20"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "installments" && <InstallmentsTab />}

        {tab === "sales" && (<>
        {/* کارت‌های خلاصه — جمعِ هر دسته جدا (بدون مجموع کل) */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
            <CalendarRange className="text-indigo-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{amountFa(totalProgram)}</div>
              <div className="text-xs text-slate-500">جمع فروش برنامه</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
            <CreditCard className="text-violet-500" size={26} />
            <div>
              <div className="text-2xl font-extrabold text-slate-800">{amountFa(totalOther)}</div>
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

        {/* نوار جستجو + فیلترِ بازه‌ی تاریخ */}
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
          {/* بازه‌ی تاریخ — روی لیست و خروجی هر دو اعمال می‌شود */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">از تاریخ:</span>
            <JalaliDatePicker value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1); }} placeholder="ابتدا" />
            <span className="text-xs font-medium text-slate-500">تا:</span>
            <JalaliDatePicker value={dateTo} onChange={(v) => { setDateTo(v); setPage(1); }} placeholder="انتها" />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
                className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100"
              >
                پاک کردن بازه
              </button>
            )}
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
                <th className="p-3.5 text-center font-medium">اقدام</th>
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
                    <div className="flex flex-wrap gap-1">
                      {(s.items?.length ? s.items : [{ product: s.product ?? "—", program_months: s.program_months, amount: 0 }]).map((it, k) => (
                        <span key={k} className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          it.product === PROGRAM ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {it.product}{it.program_months ? ` · ${faNum(it.program_months)} ماه` : ""}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3.5 align-top text-center font-extrabold text-emerald-600">
                    {amountFa(s.amount)}
                  </td>
                  <td className="p-3.5 align-top text-slate-500" dir="ltr">{s.payer_card ? faDigits(s.payer_card) : "—"}</td>
                  <td className="p-3.5 align-top text-slate-600">{s.dest_account ?? "—"}</td>
                  <td className="p-3.5 align-top text-slate-500" dir="ltr">{s.payment_ref ? faDigits(s.payment_ref) : "—"}</td>
                  <td className="p-3.5 align-top">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setEditSale(s)}
                        title="ویرایش فیش"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-100"
                      >
                        <Pencil size={15} /> ویرایش
                      </button>
                      <DeleteSaleButton sale={s} />
                    </div>
                  </td>
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
        </>)}
      </main>

      {showAdd && (
        <AddSaleModal
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ["sales"] }); }}
        />
      )}
      {editSale && (
        <AddSaleModal
          sale={editSale}
          onClose={() => setEditSale(null)}
          onAdded={() => { setEditSale(null); qc.invalidateQueries({ queryKey: ["sales"] }); }}
        />
      )}
    </div>
  );
}

/* ---------- دکمه‌ی حذفِ فیش (با تأیید) ---------- */
function DeleteSaleButton({ sale }: { sale: Sale }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(`فیشِ «${sale.student_name || sale.mobile || "بدون نام"}» به مبلغِ ${amountFa(sale.amount)} حذف شود؟ این کار قابل بازگشت نیست.`)) return;
    if (DEMO) { alert("در حالت نمایشی حذف نمی‌شود."); return; }
    setBusy(true);
    try {
      await api.delete(`/sales/${sale.id}`);
      qc.invalidateQueries({ queryKey: ["sales"] });
      toast("فیش حذف شد ✓");
    } catch {
      alert("حذف ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      title="حذف فیش"
      className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} حذف
    </button>
  );
}

/* ---------- مودال ثبت فیش (چندمحصولی + اسناد واریز) ---------- */
function AddSaleModal({ sale, onClose, onAdded }: { sale?: Sale; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const isEdit = !!sale;
  const { data: meta } = useQuery<SalesMeta>({
    queryKey: ["sales-meta"],
    queryFn: async () => (await api.get("/sales/meta")).data,
  });

  const [studentName, setStudentName] = useState(sale?.student_name ?? "");
  const [mobile, setMobile] = useState(sale?.mobile ?? "");
  // تاریخِ فیش (ISO؛ پیکر شمسی نمایش می‌دهد). برای فیشِ جدید، پیش‌فرض = امروز/اکنون
  // تا آنچه دیده می‌شود همان ذخیره شود (رفعِ ابهامِ «سیستم تاریخِ لحظه‌ی ثبت را می‌زد»).
  const [saleDate, setSaleDate] = useState(sale?.date ? sale.date.slice(0, 10) : todayIso());
  // محصولاتِ انتخاب‌شده با تیک: کلید=نام محصول، مقدار={مدت}
  const [sel, setSel] = useState<Record<string, { months: number | "" }>>(
    sale?.items?.length
      ? Object.fromEntries(sale.items.map((it) => [it.product, { months: it.program_months ?? "" }]))
      : {}
  );
  const [payAmount, setPayAmount] = useState(sale ? String(Math.round((sale.amount || 0) / 1000)) : "");
  // تاریخِ فیش یک‌بار پرسیده می‌شود (تاریخ فروش = تاریخ واریز)؛ ساعت جدا (پیش‌فرض اکنون).
  const [saleTime, setSaleTime] = useState(sale?.date ? sale.date.slice(11, 16) : nowHm());
  // بازشدن/بستنِ کشویِ محصولات (کاربر بتواند ببندد)
  const [productsOpen, setProductsOpen] = useState(true);
  const [payerCard, setPayerCard] = useState(sale?.payer_card ?? "");
  const [destAccount, setDestAccount] = useState(sale?.dest_account ?? "");
  const [paymentRef, setPaymentRef] = useState(sale?.payment_ref ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // نتیجه‌ی جست‌وجوی موبایل (مشتریِ تکراری → پرکردنِ نام + پیام خرید قبلی)
  const [lookup, setLookup] = useState<LookupResult | null>(null);

  async function onMobileBlur() {
    if (DEMO || mobile.trim().length < 8) return;
    try {
      const res = (await api.get(`/students/lookup?mobile=${encodeURIComponent(mobile)}`)).data;
      setLookup(res);
      if (res.exists && res.student_name && !studentName.trim()) setStudentName(res.student_name);
    } catch { /* بی‌صدا */ }
  }

  function toggle(product: string) {
    setSel((s) => {
      const next = { ...s };
      if (next[product]) delete next[product];
      else next[product] = { months: "" };
      return next;
    });
  }
  function patch(product: string, p: Partial<{ months: number | "" }>) {
    setSel((s) => ({ ...s, [product]: { ...s[product], ...p } }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // اعتبارسنجیِ صریح با پیامِ فارسیِ روشن (به‌جای اتکا به required مرورگر که پیامِ
    // نامفهوم می‌دهد و کاربر نمی‌فهمد کدام فیلد را پر نکرده).
    if (!studentName.trim()) { setError("نام و نام خانوادگی را وارد کنید."); return; }
    if (mobile.replace(/\D/g, "").length < 8) { setError("شماره‌ی موبایل را کامل وارد کنید."); return; }
    const picked = Object.entries(sel);
    if (picked.length === 0) { setError("حداقل یک محصول را تیک بزنید."); setProductsOpen(true); return; }
    for (const [product, v] of picked) {
      if (product === PROGRAM && !v.months) { setError("برای «برنامه»، مدت (ماه) را انتخاب کنید."); setProductsOpen(true); return; }
    }
    if (!payAmount || Number(payAmount) <= 0) { setError("مبلغِ واریز را وارد کنید."); return; }
    setLoading(true);
    try {
      if (DEMO) {
        alert(isEdit ? "در حالت نمایشی، ویرایش ذخیره نمی‌شود." : "در حالت نمایشی، ثبت فیش ذخیره نمی‌شود.");
        onClose();
        return;
      }
      // یک تاریخ برای کلِ فیش (فروش = واریز). ساعتِ پیش‌فرض ۱۲ ظهر تا با اختلافِ
      // منطقه‌ی زمانی، روزِ فروش عوض نشود.
      const soldAtIso = saleDate
        ? new Date(`${saleDate}T${saleTime || "12:00"}`).toISOString()
        : null;
      const payload = {
        student_name: studentName,
        mobile,
        sold_at: soldAtIso,
        items: picked.map(([product, v]) => ({
          product,
          program_months: product === PROGRAM ? v.months : null,
        })),
        amount: thousandsToToman(payAmount),
        deposited_at: soldAtIso,
        payer_card: payerCard || null,
        dest_account: destAccount || null,
        payment_ref: paymentRef || null,
      };
      if (isEdit) {
        await api.patch(`/sales/${sale!.id}`, payload);
        toast("فیش ویرایش شد ✓");
      } else {
        await api.post("/sales", payload);
        toast("فیش فروش ثبت شد ✓");
      }
      onAdded();
    } catch (err) {
      setError(apiErrorMessage(err, "ثبت فیش ناموفق بود. ورودی‌ها را بررسی کنید."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">{isEdit ? "ویرایش فیش فروش" : "ثبت فیش فروش"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {/* مشخصات مشتری */}
          <input
            placeholder="نام و نام خانوادگی"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
          <input
            type="tel"
            placeholder="شماره تلفن (مثلاً ۰۹۱۲۳۴۵۶۷۸۹)"
            value={mobile}
            onChange={(e) => { setMobile(e.target.value); setLookup(null); }}
            onBlur={onMobileBlur}
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            dir="ltr"
          />
          {/* مشتریِ تکراری: پیام «دوباره فروختی» + خرید قبلی */}
          {lookup?.exists && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              👌 تبریک، دوباره فروختی! <b>{lookup.student_name || "این شخص"}</b> از قبل ثبت شده
              {lookup.created_at ? ` (تاریخ ثبت: ${faDate(lookup.created_at)})` : ""}
              {typeof lookup.purchase_count === "number" && lookup.purchase_count > 0
                ? ` و تا حالا ${faNum(lookup.purchase_count)} خرید داشته.` : "."}
              {lookup.purchases?.[0] && (
                <div className="mt-1 text-amber-700">
                  آخرین خرید: {lookup.purchases[0].product} — {showDate(lookup.purchases[0].date)}
                </div>
              )}
            </div>
          )}
          {/* تاریخِ فیش — یک‌بار (تاریخ + ساعت). خالی = امروز. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-600">تاریخ فیش:</span>
            <JalaliDatePicker value={saleDate} onChange={setSaleDate} placeholder="امروز" />
            <span className="text-xs font-medium text-slate-600">ساعت:</span>
            <input type="time" value={saleTime} onChange={(e) => setSaleTime(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-emerald-400" dir="ltr" />
            <span className="w-full text-[11px] text-slate-400">تاریخِ فروش/واریز (خالی = امروز)</span>
          </div>

          {/* محصولات — کشویی: باز/بسته می‌شود؛ هر چند محصول را تیک بزن */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <button
              type="button"
              onClick={() => setProductsOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 text-sm font-medium text-slate-700"
            >
              <span>
                محصولات خریداری‌شده
                {Object.keys(sel).length > 0
                  ? <span className="mr-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">{faNum(Object.keys(sel).length)} انتخاب</span>
                  : <span className="mr-1 text-xs font-normal text-slate-400">(برای انتخاب باز کن)</span>}
              </span>
              <ChevronDown size={18} className={`shrink-0 text-slate-400 transition ${productsOpen ? "rotate-180" : ""}`} />
            </button>
            {/* خلاصه‌ی انتخاب‌ها وقتی بسته است */}
            {!productsOpen && Object.keys(sel).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.keys(sel).map((p) => (
                  <span key={p} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                    {p}{p === PROGRAM && sel[p].months ? ` · ${faNum(Number(sel[p].months))} ماه` : ""}
                  </span>
                ))}
              </div>
            )}
            {productsOpen && (
            <div className="mt-2 space-y-1.5">
              {(meta?.products ?? []).map((p) => {
                const picked = !!sel[p];
                return (
                  <div key={p} className={`rounded-lg border p-2 ${picked ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={picked}
                        onChange={() => toggle(p)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span className="flex-1 text-sm text-slate-700">{p}</span>
                    </label>
                    {/* مدت — فقط برای «برنامه»ی تیک‌خورده */}
                    {picked && p === PROGRAM && (
                      <select
                        value={sel[p].months}
                        onChange={(e) => patch(p, { months: Number(e.target.value) })}
                        className="mt-2 w-full rounded-lg border border-indigo-300 bg-indigo-50/40 px-2 py-2 text-sm outline-none focus:border-indigo-400"
                      >
                        <option value="" disabled>مدت برنامه…</option>
                        {(meta?.program_months ?? []).map((m) => (
                          <option key={m} value={m}>{faNum(m)} ماه</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* مبلغِ واریز — یک مبلغ برای کلِ فیش */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">مبلغ واریز</label>
            <input
              type="number"
              placeholder="مبلغ واریز (هزار تومان)"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
              dir="ltr"
              min={0}
            />
            {Number(payAmount) > 0 && (
              <div className="mt-1 text-xs text-emerald-600">
                = {faNum(Number(payAmount) * 1000)} تومان
              </div>
            )}
          </div>

          {/* اسناد واریز */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-2 text-sm font-medium text-slate-700">اسناد واریز</div>
            <div className="space-y-2">
              <input
                placeholder="کارت واریزکننده"
                value={payerCard}
                onChange={(e) => setPayerCard(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                dir="ltr"
              />
              <input
                placeholder="بانک مقصد / حساب ما (به دلخواه؛ مثلاً: محمدجواد شهیدی — سپه — ۱۹۲۶)"
                value={destAccount}
                onChange={(e) => setDestAccount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
              />
              <input
                placeholder="جزئیات واریز (کد رهگیری) — اختیاری"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-400"
                dir="ltr"
              />
            </div>
          </div>

          {/* دکمه‌ی ثبتِ چسبان به پایینِ مودال — پیامِ خطا همین‌جا (همیشه دیده می‌شود) */}
          <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-slate-100 bg-white px-6 py-3">
            {error && <div className="mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{error}</div>}
            <button
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? "ذخیره تغییرات" : "ثبت فیش"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
