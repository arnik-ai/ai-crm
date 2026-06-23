"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

/**
 * نگهبان احراز هویت: اگر کاربر وارد نشده باشد، به صفحه‌ی ورود می‌فرستد.
 *
 * demo-aware: در حالت دمو (روی GitHub Pages) همیشه اجازه می‌دهد تا نمایش
 * بدون ورود ممکن باشد. در حالت واقعی، نبودِ توکن = ریدایرکت به /login.
 *
 * تا زمان بررسی (پس از mount) چیزی رندر نمی‌کند تا از پرشِ محتوا جلوگیری شود.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      setOk(true);
    } else {
      router.replace("/login");
    }
  }, [router]);

  if (!ok) return null;
  return <>{children}</>;
}
