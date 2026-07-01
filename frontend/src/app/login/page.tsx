"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isDemoMode } from "@/lib/auth";
import {
  MessageSquare, Mail, Loader2, Phone, Lock, KeyRound,
  Sparkles, BarChart3, PhoneCall, ShieldCheck,
} from "lucide-react";

type Tab = "otp" | "password";
type OtpStep = "phone" | "code";

const DEMO = isDemoMode();

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("password");

  function goDashboard() {
    router.push("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4">
      {/* بلاب‌های تزئینیِ پس‌زمینه */}
      <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-blue-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-indigo-300/30 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200/70 md:grid-cols-2">
        {/* پنلِ معرفی (فقط دسکتاپ) */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 p-8 text-white md:flex">
          <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-xl font-extrabold shadow-inner backdrop-blur">
                C
              </div>
              <span className="text-lg font-extrabold tracking-tight">CRM هوشمند</span>
            </div>
            <h2 className="text-2xl font-black leading-relaxed">
              مدیریتِ فروش و مشاوره،
              <br />
              هوشمند و ساده.
            </h2>
            <p className="mt-3 text-sm leading-6 text-blue-100">
              تماس‌ها، دانش‌آموزان و فروش را یک‌جا مدیریت کن؛ هوش مصنوعی خودش
              خلاصه و پیگیری را برایت آماده می‌کند.
            </p>
          </div>
          <ul className="relative mt-8 space-y-3 text-sm">
            <Feature icon={<PhoneCall size={16} />} text="ثبتِ خودکارِ تماس‌ها و ضبطِ مکالمه" />
            <Feature icon={<Sparkles size={16} />} text="خلاصه و تحلیلِ هوش مصنوعی" />
            <Feature icon={<BarChart3 size={16} />} text="گزارش‌های فروش و عملکردِ تیم" />
            <Feature icon={<ShieldCheck size={16} />} text="دسترسیِ نقش‌محور و امن" />
          </ul>
        </div>

        {/* بخشِ فرم */}
        <div className="p-6 sm:p-8">
          {/* لوگو (روی موبایل) */}
          <div className="mb-6 flex flex-col items-center gap-2 md:items-start">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-extrabold text-white shadow-md md:hidden">
              C
            </div>
            <h1 className="text-xl font-black text-slate-800">ورود به حساب</h1>
            <p className="text-sm text-slate-500">برای ادامه، وارد شوید.</p>
          </div>

          {/* تب‌ها */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setTab("password")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                tab === "password" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Mail size={15} /> ایمیل و رمز
            </button>
            <button
              onClick={() => setTab("otp")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                tab === "otp" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <MessageSquare size={15} /> ورود با پیامک
            </button>
          </div>

          {tab === "otp" ? (
            <OtpForm onSuccess={goDashboard} />
          ) : (
            <PasswordForm onSuccess={goDashboard} />
          )}

          {/* راهنمای ساخت حساب — چون CRM ثبت‌نامِ عمومی ندارد */}
          <p className="mt-5 border-t border-slate-100 pt-4 text-center text-xs leading-5 text-slate-400">
            حسابِ جدید توسطِ <span className="font-medium text-slate-500">مدیرِ سیستم</span> در بخشِ
            «کاربران» ساخته می‌شود؛ ثبت‌نامِ عمومی وجود ندارد.
          </p>

          {DEMO && (
            <p className="mt-3 rounded-lg bg-amber-50 py-1.5 text-center text-xs text-amber-600">
              حالت نمایشی: ورود واقعی نیاز به اتصال بک‌اند دارد.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
        {icon}
      </span>
      <span className="text-blue-50">{text}</span>
    </li>
  );
}

/* ---------- ورودیِ زیبا با آیکن ---------- */
function Field({
  icon, ...props
}: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
        {icon}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-2.5 pr-10 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 py-2.5 font-semibold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] disabled:opacity-60"
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ---------- ورود با پیامک (دو مرحله: شماره → کد) ---------- */
function OtpForm({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<OtpStep>("phone");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setHint(""); setLoading(true);
    try {
      if (DEMO) {
        setHint("کد نمایشی: ۱۲۳۴۵");
        setStep("code");
        return;
      }
      const { data } = await api.post("/auth/otp/request", { mobile });
      if (data?.debug_code) setHint(`کد (تست): ${data.debug_code}`);
      setStep("code");
    } catch {
      setError("ارسال کد ناموفق بود. شماره را بررسی کنید.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (DEMO) {
        onSuccess();
        return;
      }
      const { data } = await api.post("/auth/otp/verify", { mobile, code });
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      onSuccess();
    } catch {
      setError("کد واردشده نادرست است.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={requestCode} className="space-y-3">
        <Field
          icon={<Phone size={16} />}
          type="tel"
          placeholder="شماره موبایل (مثلاً ۰۹۱۲۳۴۵۶۷۸۹)"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          dir="ltr"
          required
        />
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <SubmitButton loading={loading}>دریافت کد</SubmitButton>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-3">
      <div className="text-center text-xs text-slate-500">
        کد به شماره‌ی <span dir="ltr">{mobile}</span> ارسال شد
      </div>
      {hint && (
        <div className="rounded-lg bg-amber-50 py-1.5 text-center text-sm font-bold text-amber-700">
          {hint}
        </div>
      )}
      <Field
        icon={<KeyRound size={16} />}
        type="text"
        inputMode="numeric"
        placeholder="کد ۵ رقمی"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        dir="ltr"
        required
      />
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <SubmitButton loading={loading}>ورود</SubmitButton>
      <button
        type="button"
        onClick={() => { setStep("phone"); setCode(""); setError(""); }}
        className="w-full text-center text-xs text-slate-400 hover:text-slate-600"
      >
        تغییر شماره
      </button>
    </form>
  );
}

/* ---------- ورود با ایمیل و رمز ---------- */
function PasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (DEMO) {
        onSuccess();
        return;
      }
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      onSuccess();
    } catch {
      setError("ایمیل یا رمز عبور نادرست است");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field
        icon={<Mail size={16} />}
        type="email"
        placeholder="ایمیل"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        dir="ltr"
        required
      />
      <Field
        icon={<Lock size={16} />}
        type="password"
        placeholder="رمز عبور"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        dir="ltr"
        required
      />
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <SubmitButton loading={loading}>ورود</SubmitButton>
    </form>
  );
}
