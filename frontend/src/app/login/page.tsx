"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isDemoMode } from "@/lib/auth";
import { MessageSquare, Mail, Loader2, Phone, Lock, KeyRound } from "lucide-react";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#2c3e5c] via-[#334766] to-[#3b5378] p-4">
      {/* بلاب‌های تزئینیِ پس‌زمینه (هم‌رنگِ برند، ملایم روی زمینه‌ی سرمه‌ای) */}
      <div className="pointer-events-none absolute -top-40 -right-32 h-96 w-96 rounded-full bg-blue-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" />

      {/* کارتِ فرم با بوردرِ گرادیانیِ برند (آبی→نیلی) */}
      <div className="relative z-10 w-full max-w-md rounded-[30px] bg-gradient-to-br from-blue-500 to-indigo-600 p-[3px] shadow-2xl shadow-black/30">
        <div className="rounded-[27px] bg-white p-7 ring-1 ring-inset ring-slate-100 sm:p-9">
          {/* برند */}
          <div className="mb-7 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-indigo-500/50 blur-xl" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-3xl font-black text-white shadow-lg shadow-indigo-500/40">
                K
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-2xl font-black text-slate-800">
                  <span className="text-blue-600">CRM</span> کنکورستان
                </h1>
                <span className="rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 px-1.5 py-0.5 text-[11px] font-black text-white shadow-sm">
                  AI
                </span>
              </div>
              <p className="mt-1.5 text-[11px] font-bold tracking-[0.25em] text-slate-400">
                KONKURESTAN&nbsp;AI&nbsp;CRM
              </p>
              <p className="mt-2.5 text-sm text-slate-500">
                سامانه‌ی هوشمندِ مدیریتِ فروش و مشاوره
              </p>
            </div>
          </div>

          {/* تب‌ها */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100/80 p-1">
            <button
              onClick={() => setTab("password")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition ${
                tab === "password"
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Mail size={15} /> ایمیل و رمز
            </button>
            <button
              onClick={() => setTab("otp")}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition ${
                tab === "otp"
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
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
          <p className="mt-6 border-t border-slate-100 pt-4 text-center text-xs leading-5 text-slate-400">
            حسابِ جدید توسطِ <span className="font-medium text-slate-500">مدیرِ سیستم</span> در بخشِ
            «کاربران» ساخته می‌شود.
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

/* ---------- ورودیِ زیبا با آیکن ---------- */
function Field({
  icon, ...props
}: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="group relative">
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-blue-500">
        {icon}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 pr-10 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />
    </div>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      disabled={loading}
      className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 py-3 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-500/40 active:scale-[0.98] disabled:opacity-60"
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
