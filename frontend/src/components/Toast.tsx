"use client";
import { createContext, useCallback, useContext, useState } from "react";

type ToastType = "success" | "error";
type ToastItem = { id: number; msg: string; type: ToastType };

const ToastCtx = createContext<(msg: string, type?: ToastType) => void>(() => {});

/** نمایشِ پیامِ شناور (toast). استفاده: const toast = useToast(); toast("ذخیره شد ✓"). */
export const useToast = () => useContext(ToastCtx);

let _seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((msg: string, type: ToastType = "success") => {
    const id = ++_seq;
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
              t.type === "error" ? "bg-rose-600" : "bg-emerald-600"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
