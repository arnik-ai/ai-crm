"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * مودالِ تأییدِ فارسیِ زیبا — جایگزینِ `window.confirm()`ِ زشتِ مرورگر (OK/Cancel انگلیسی).
 *
 * استفاده:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: "حذف شود؟", message: "…", danger: true });
 *   if (!ok) return;
 *
 * یک Promise<boolean> برمی‌گرداند؛ true = تأیید، false = انصراف/بستن.
 * هیچ منطقی را عوض نمی‌کند؛ فقط ظاهرِ پرسش را فارسی و هماهنگ با برنامه می‌کند.
 */
type ConfirmOptions = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean; // دکمه‌ی تأیید قرمز (برای کارهای خطرناک مثل حذف)
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn>(async () => false);

export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  }, []);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {opts && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${
                opts.danger ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"
              }`}
            >
              <AlertTriangle size={28} />
            </div>
            <h2 className="mb-1.5 text-lg font-bold text-slate-800">
              {opts.title ?? "مطمئنی؟"}
            </h2>
            {opts.message && (
              <p className="mb-5 text-sm leading-6 text-slate-500">{opts.message}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => close(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                {opts.cancelText ?? "نه، بی‌خیال"}
              </button>
              <button
                onClick={() => close(true)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition ${
                  opts.danger
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {opts.confirmText ?? "بله"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
