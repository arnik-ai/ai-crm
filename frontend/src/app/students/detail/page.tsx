"use client";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiErrorMessage } from "@/lib/api";
import { isDemoMode, isManager, getSession } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { CallButton } from "@/components/CallButton";
import { ContactLinks } from "@/components/ContactLinks";
import { MessageModal } from "@/components/MessageModal";
import { faNum, faDate, faDateTime } from "@/lib/utils";
import { levelInfo } from "@/lib/loyalty";
import { useToast } from "@/components/Toast";
import { useConfirm } from "@/components/ConfirmDialog";
import { User, Phone, MessageSquare, Pencil, Trash2, Loader2, X, GraduationCap, Gift, Copy, Check, Send, ChevronDown } from "lucide-react";

const DEMO = isDemoMode();
const FIELDS = ["تجربی", "ریاضی", "انسانی", "سایر"];
const GRADES = ["دهم", "یازدهم", "دوازدهم", "فارغ‌التحصیل", "سایر"];
const SOURCES = ["سایت", "اینستاگرام", "تلگرام", "روبیکا", "بله", "پیامک", "سایر"];

type Student = {
  id: string;
  full_name: string | null;
  mobile: string;
  status: string;
  city?: string | null;
  field?: string | null;
  grade?: string | null;
  goal?: string | null;
  gpa?: number | null;
  lead_source?: string | null;
  assigned_agent_id?: string | null;
  last_outcome?: string | null;
  created_at?: string;
};

/** یک سطرِ اطلاعات (برچسب + مقدار) — اگر مقدار نبود، «—». */
function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value ?? <span className="text-slate-300">—</span>}</span>
    </div>
  );
}

function StudentDetail() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [showMsg, setShowMsg] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: s, isLoading, isError } = useQuery<Student>({
    queryKey: ["student", id],
    queryFn: async () => (await api.get(`/students/${id}`)).data,
    enabled: !!id && !DEMO,
  });

  async function onDelete() {
    if (!s) return;
    const ok = await confirm({
      title: "حذفِ این دانش‌آموز؟",
      message: `«${s.full_name || s.mobile}» برای همیشه حذف می‌شود.`,
      confirmText: "بله، حذف کن", cancelText: "نه، بی‌خیال", danger: true,
    });
    if (!ok) return;
    if (DEMO) { toast("در حالت نمایشی حذف نمی‌شود.", "error"); return; }
    setDeleting(true);
    try {
      await api.delete(`/students/${s.id}`);
      qc.invalidateQueries({ queryKey: ["students"] });
      toast("حذف شد ✓");
      router.push("/students");
    } catch {
      toast("حذف ناموفق بود.", "error");
      setDeleting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-200">
              <User size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">جزئیات دانشجو</h1>
              <p className="mt-0.5 text-sm text-slate-300">اطلاعات کامل و اقدام‌ها</p>
            </div>
          </div>
          <BackButton dark />
        </div>

        {DEMO ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            در حالت نمایشی، جزئیاتِ زنده در دسترس نیست.
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-slate-400 shadow-sm">
            <Loader2 className="animate-spin" size={18} /> در حال بارگذاری…
          </div>
        ) : isError || !s ? (
          <div className="rounded-2xl border border-rose-100 bg-white p-8 text-center text-slate-500 shadow-sm">
            دانشجو یافت نشد.
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            {/* کارت نام + اقدام‌ها */}
            <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-lg font-bold text-blue-600">
                  {(s.full_name ?? "?").charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold text-slate-800">{s.full_name || "بدون نام"}</div>
                  <div className="text-sm text-slate-400" dir="ltr">{s.mobile}</div>
                </div>
                {s.last_outcome && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    نتیجه: {s.last_outcome}
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <CallButton mobile={s.mobile} size="sm" />
                <ContactLinks mobile={s.mobile} />
                <button
                  onClick={() => setShowMsg(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:bg-violet-100"
                >
                  <MessageSquare size={15} /> پیام
                </button>
                <button
                  onClick={() => setShowEdit(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                >
                  <Pencil size={15} /> ویرایش
                </button>
                <button
                  onClick={onDelete}
                  disabled={deleting}
                  className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} حذف
                </button>
              </div>
            </div>

            {/* کارت اطلاعات */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <Row label="پایه" value={s.grade} />
              <Row label="رشته" value={s.field} />
              <Row label="هدف" value={s.goal} />
              <Row label="معدل" value={s.gpa != null ? faNum(s.gpa) : undefined} />
              <Row label="شهر" value={s.city} />
              <Row label="منبع تماس" value={s.lead_source} />
              <Row label="وضعیت" value={s.status === "active" ? "فعال" : s.status} />
              <Row label="تاریخ ثبت" value={s.created_at ? faDate(s.created_at) : undefined} />
            </div>

            {/* باشگاه مشتریان — اگر ماژول خاموش/حذف باشد، خودش پنهان می‌شود */}
            <LoyaltyCard studentId={s.id} />
          </div>
        )}

        {s && showMsg && (
          <MessageModal
            student={{ id: s.id, full_name: s.full_name, mobile: s.mobile }}
            onClose={() => setShowMsg(false)}
          />
        )}
        {s && showEdit && <EditModal student={s} onClose={() => setShowEdit(false)} />}
      </main>
    </div>
  );
}

/* ---------- مودال ویرایش/تکمیل ---------- */
function EditModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [fullName, setFullName] = useState(student.full_name ?? "");
  const [city, setCity] = useState(student.city ?? "");
  const [fld, setFld] = useState(student.field ?? "");
  const [grade, setGrade] = useState(student.grade ?? "");
  const [goal, setGoal] = useState(student.goal ?? "");
  const [gpa, setGpa] = useState(student.gpa != null ? String(student.gpa) : "");
  const [source, setSource] = useState(student.lead_source ?? "");
  const [advisor, setAdvisor] = useState(student.assigned_agent_id ?? "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const canAssign = isManager(getSession());
  const { data: advisorsData } = useQuery<{ items: { id: string; full_name: string }[] }>({
    queryKey: ["advisors"],
    queryFn: async () => (await api.get("/students/advisors")).data,
    enabled: canAssign && !DEMO,
  });
  const advisors = advisorsData?.items ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setLoading(true);
    try {
      if (DEMO) { setMsg("در حالت نمایشی ذخیره نمی‌شود."); setLoading(false); return; }
      await api.patch(`/students/${student.id}`, {
        full_name: fullName || null,
        city: city || null,
        field: fld || null,
        grade: grade || null,
        goal: goal || null,
        gpa: gpa ? Number(gpa) : null,
        lead_source: source || null,
        ...(canAssign ? { assigned_agent_id: advisor || null } : {}),
      });
      qc.invalidateQueries({ queryKey: ["student", student.id] });
      qc.invalidateQueries({ queryKey: ["students"] });
      toast("اطلاعات ذخیره شد ✓");
      onClose();
    } catch { setMsg("ذخیره ناموفق بود."); setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold text-slate-800">
            <Pencil size={18} className="text-blue-600" /> ویرایش / تکمیل اطلاعات
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <p className="mb-4 text-sm text-slate-500" dir="ltr">{student.mobile}</p>
        <form onSubmit={submit} className="space-y-3">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="نام و نام خانوادگی"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
          <div className="grid grid-cols-2 gap-3">
            <select value={fld} onChange={(e) => setFld(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
              <option value="">رشته…</option>
              {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={grade} onChange={(e) => setGrade(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
              <option value="">پایه…</option>
              {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="هدف (مثلاً پزشکی دانشگاه تهران)"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
          <div className="grid grid-cols-2 gap-3">
            <input value={gpa} onChange={(e) => setGpa(e.target.value)} type="number" placeholder="معدل" min={0} max={20} step="0.01"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400" dir="ltr" />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="شهر"
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
          </div>
          <select value={source} onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
            <option value="">منبع تماس…</option>
            {SOURCES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          {canAssign && (
            <select value={advisor} onChange={(e) => setAdvisor(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
              <option value="">مشاورِ مسئول… (بدون تخصیص)</option>
              {advisors.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            {msg && <span className="mr-auto text-xs text-slate-500">{msg}</span>}
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">انصراف</button>
            <button disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60">
              {loading && <Loader2 size={15} className="animate-spin" />} ذخیره
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- کارتِ باشگاه مشتریان (خودپنهان‌شونده اگر ماژول خاموش/حذف باشد) ---------- */
type LoyaltyAcc = {
  points_balance: number; points_lifetime: number; level: string; referral_code: string | null;
};
type LoyaltyTxn = { delta: number; reason: string; created_at: string | null };

/** برچسبِ فارسیِ دلیلِ هر امتیاز (کلیدِ قانون → متنِ خوانا). */
const REASON_LABEL: Record<string, string> = {
  call_success: "تماس موفق",
  call_answered: "پاسخ به تماس",
  call_missed: "تماس بی‌پاسخ",
  purchase_points: "خرید",
  purchase_2nd_bonus: "پاداشِ خریدِ دوم",
  referral_signup: "معرفیِ دوست",
  referral_purchase: "خریدِ دوستِ معرفی‌شده",
};
function reasonLabel(reason: string): string {
  if (reason?.startsWith("redeem:")) return "خرجِ پاداش";
  return REASON_LABEL[reason] ?? reason ?? "—";
}

function LoyaltyCard({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [refCode, setRefCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data, isError } = useQuery<LoyaltyAcc>({
    queryKey: ["loyalty-account", studentId],
    queryFn: async () => (await api.get(`/loyalty/accounts/${studentId}`)).data,
    retry: false,
    enabled: !DEMO,
  });

  const { data: txns } = useQuery<LoyaltyTxn[]>({
    queryKey: ["loyalty-txns", studentId],
    queryFn: async () => (await api.get(`/loyalty/accounts/${studentId}/transactions`)).data.items,
    retry: false,
    enabled: !DEMO && showHistory,   // فقط وقتی کاربر تاریخچه را باز کند
  });

  // ماژول خاموش/حذف یا دمو → کارت اصلاً نشان داده نمی‌شود.
  if (DEMO || isError || !data) return null;

  const info = levelInfo(data.level);

  function copyCode() {
    if (!data?.referral_code) return;
    navigator.clipboard?.writeText(data.referral_code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function applyReferral() {
    if (!refCode.trim()) return;
    setApplying(true);
    try {
      await api.post("/loyalty/referrals/apply", { code: refCode.trim(), student_id: studentId });
      toast("کدِ معرف اعمال شد ✓");
      setRefCode("");
      qc.invalidateQueries({ queryKey: ["loyalty-account", studentId] });
    } catch (err) {
      toast(apiErrorMessage(err, "کدِ معرف نامعتبر بود."), "error");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/40 p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Gift size={18} className="text-violet-500" />
        <h2 className="font-bold text-slate-800">باشگاه مشتریان</h2>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ring-1 ${info.cls}`}>
          {info.emoji} {info.label}
        </span>
        <div className="rounded-xl bg-white px-3 py-1.5 ring-1 ring-slate-100">
          <span className="text-lg font-extrabold text-violet-600">{faNum(data.points_balance)}</span>
          <span className="mr-1 text-xs text-slate-400">امتیازِ قابلِ‌خرج</span>
        </div>
        <div className="text-xs text-slate-400">کلِ کسب‌شده: {faNum(data.points_lifetime)}</div>
      </div>

      {/* کد دعوت */}
      {data.referral_code && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-500">کد دعوتِ این دانش‌آموز:</span>
          <code className="rounded-lg bg-slate-100 px-2 py-1 text-sm font-bold tracking-widest text-slate-700" dir="ltr">
            {data.referral_code}
          </code>
          <button onClick={copyCode} title="کپی" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
          </button>
        </div>
      )}

      {/* اعمالِ کدِ معرف (چه کسی این دانش‌آموز را معرفی کرده) */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-violet-100 pt-3">
        <span className="text-xs text-slate-500">کدِ معرف (اگر کسی معرفی‌اش کرده):</span>
        <input
          value={refCode}
          onChange={(e) => setRefCode(e.target.value.toUpperCase())}
          placeholder="مثلاً 7K3M9Q"
          dir="ltr"
          className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-violet-400"
        />
        <button
          onClick={applyReferral}
          disabled={applying || !refCode.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          {applying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} اعمال
        </button>
      </div>

      {/* تاریخچه‌ی امتیاز — جمع‌شونده (تا کارمند ببیند هر امتیاز از کجا آمده) */}
      <div className="mt-3 border-t border-violet-100 pt-3">
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700"
        >
          <ChevronDown size={15} className={`transition ${showHistory ? "rotate-180" : ""}`} />
          تاریخچه‌ی امتیاز
        </button>
        {showHistory && (
          <div className="mt-2 space-y-1.5">
            {(txns ?? []).map((t, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-sm ring-1 ring-slate-100">
                <span className={`min-w-[3rem] font-bold ${t.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`} dir="ltr">
                  {t.delta >= 0 ? "+" : ""}{faNum(t.delta)}
                </span>
                <span className="flex-1 text-slate-700">{reasonLabel(t.reason)}</span>
                <span className="text-[11px] text-slate-400">{faDateTime(t.created_at ?? undefined)}</span>
              </div>
            ))}
            {(txns ?? []).length === 0 && (
              <p className="py-3 text-center text-xs text-slate-400">هنوز امتیازی ثبت نشده.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center text-slate-300">
        <GraduationCap className="mr-2 animate-pulse" size={20} /> در حال بارگذاری…
      </div>
    }>
      <StudentDetail />
    </Suspense>
  );
}
