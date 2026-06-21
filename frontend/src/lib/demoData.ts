/**
 * داده‌ی نمونه (دمو) برای دیدن ظاهر داشبورد بدون نیاز به دیتابیس/بک‌اند.
 *
 * فعال‌سازی: در فایل .env.local مقدار NEXT_PUBLIC_DEMO=1 بگذار (یا اگر بک‌اند
 * در دسترس نباشد، به‌صورت خودکار از این داده‌ها استفاده می‌شود).
 *
 * این فایل کاملاً جداست و هیچ کد اصلی را تغییر نمی‌دهد؛ هر وقت خواستی حذفش کن.
 */

export const demoSummary = {
  calls_today: 42,
  calls_week: 318,
  hot_leads: 17,
  warm_leads: 54,
  cold_leads: 120,
  followups_today: 9,
  conversion_rate: 0.23,
};

export const demoFunnel = {
  stages: [
    { name: "سرنخ جدید", count: 120, color: "#94a3b8" },
    { name: "تماس گرفته‌شده", count: 86, color: "#60a5fa" },
    { name: "علاقه‌مند", count: 54, color: "#34d399" },
    { name: "مشاوره", count: 31, color: "#fbbf24" },
    { name: "مذاکره", count: 18, color: "#f97316" },
    { name: "ثبت‌نام‌شده", count: 12, color: "#22c55e" },
    { name: "ازدست‌رفته", count: 9, color: "#ef4444" },
  ],
};

export const demoTrend = {
  points: [
    { date: "2026-06-15", inbound: 18, outbound: 12, total: 30 },
    { date: "2026-06-16", inbound: 24, outbound: 15, total: 39 },
    { date: "2026-06-17", inbound: 21, outbound: 19, total: 40 },
    { date: "2026-06-18", inbound: 30, outbound: 22, total: 52 },
    { date: "2026-06-19", inbound: 27, outbound: 17, total: 44 },
    { date: "2026-06-20", inbound: 33, outbound: 25, total: 58 },
    { date: "2026-06-21", inbound: 28, outbound: 14, total: 42 },
  ],
};

export const demoStudents = {
  items: [
    { id: "1", full_name: "سارا محمدی", mobile: "+989121234567", status: "active",
      course: "تجربی", grade: "دوازدهم", goal: "پزشکی دانشگاه تهران",
      lead_score: 78, stage: "مشاوره", last_call: "۲ ساعت پیش" },
    { id: "2", full_name: "علی رضایی", mobile: "+989352223344", status: "active",
      course: "ریاضی", grade: "یازدهم", goal: "مهندسی کامپیوتر شریف",
      lead_score: 52, stage: "علاقه‌مند", last_call: "دیروز" },
    { id: "3", full_name: "نگار حسینی", mobile: "+989019998877", status: "active",
      course: "تجربی", grade: "فارغ‌التحصیل", goal: "دندان‌پزشکی شهید بهشتی",
      lead_score: 91, stage: "مذاکره", last_call: "۱ ساعت پیش" },
    { id: "4", full_name: "محمد کریمی", mobile: "+989127776655", status: "inactive",
      course: "انسانی", grade: "دهم", goal: "حقوق دانشگاه تهران",
      lead_score: 33, stage: "تماس گرفته‌شده", last_call: "۵ روز پیش" },
    { id: "5", full_name: "زهرا اکبری", mobile: "+989364445566", status: "active",
      course: "ریاضی", grade: "دوازدهم", goal: "مهندسی برق امیرکبیر",
      lead_score: 67, stage: "علاقه‌مند", last_call: "۳ ساعت پیش" },
    { id: "6", full_name: "رضا قاسمی", mobile: "+989101112233", status: "active",
      course: "انسانی", grade: "یازدهم", goal: "روان‌شناسی دانشگاه تهران",
      lead_score: 45, stage: "سرنخ جدید", last_call: "—" },
  ],
  total: 6,
  page: 1,
  size: 20,
};

export const demoCalls = {
  items: [
    { id: "1", direction: "inbound", status: "answered",
      student_name: "سارا محمدی", caller_number: "+989121234567",
      duration_sec: 372, started_at: "2026-06-21T08:30:00Z", lead_score: 78,
      summary: "علاقه‌مند به دوره‌ی تجربی؛ نگران شهریه است. پیشنهاد اقساط احتمال ثبت‌نام را بالا می‌برد.",
      signals: ["پرسیدن درباره‌ی اقساط", "درخواست مشاوره حضوری"], confidence: 0.92 },
    { id: "2", direction: "outbound", status: "answered",
      student_name: "علی رضایی", caller_number: "+989352223344",
      duration_sec: 145, started_at: "2026-06-21T09:15:00Z", lead_score: 52,
      summary: "تماس پیگیری؛ هنوز در حال تصمیم‌گیری بین دو مؤسسه است.",
      signals: ["مقایسه با رقبا"], confidence: 0.74 },
    { id: "3", direction: "inbound", status: "answered",
      student_name: "نگار حسینی", caller_number: "+989019998877",
      duration_sec: 521, started_at: "2026-06-21T10:05:00Z", lead_score: 91,
      summary: "سرنخ داغ! آماده‌ی ثبت‌نام برای دندان‌پزشکی؛ فقط منتظر هماهنگی زمان کلاس است.",
      signals: ["درخواست ثبت‌نام", "پرسیدن زمان شروع کلاس", "فوریت بالا"], confidence: 0.95 },
    { id: "4", direction: "inbound", status: "missed",
      student_name: "محمد کریمی", caller_number: "+989127776655",
      duration_sec: 0, started_at: "2026-06-21T11:40:00Z", lead_score: 33,
      summary: "تماس بی‌پاسخ — نیاز به پیگیری.",
      signals: [], confidence: 1 },
    { id: "5", direction: "outbound", status: "answered",
      student_name: "زهرا اکبری", caller_number: "+989364445566",
      duration_sec: 264, started_at: "2026-06-21T13:20:00Z", lead_score: 67,
      summary: "سؤال درباره‌ی شهریه و تخفیف؛ احتمالاً علاقه‌مند ولی صدا واضح نبود — نیاز به بازبینی.",
      signals: ["پرسیدن تخفیف"], confidence: 0.41 },
  ],
  total: 5,
  page: 1,
  size: 20,
};

export const demoFollowupsToday = {
  items: [
    { id: "f1", student_name: "نگار حسینی", mobile: "+989019998877",
      course: "تجربی · دندان‌پزشکی", lead_score: 91, note: "ارسال طرح اقساطی", time: "۱۰:۰۰" },
    { id: "f2", student_name: "سارا محمدی", mobile: "+989121234567",
      course: "تجربی · پزشکی", lead_score: 78, note: "پیگیری ثبت‌نام", time: "۱۱:۳۰" },
    { id: "f3", student_name: "زهرا اکبری", mobile: "+989364445566",
      course: "ریاضی · مهندسی برق", lead_score: 67, note: "پاسخ به سؤال شهریه", time: "۱۴:۰۰" },
  ],
};

/** نگاشت مسیر API → داده‌ی دموی متناظر. */
export const demoByPath: Record<string, unknown> = {
  "/dashboard/summary": demoSummary,
  "/dashboard/funnel": demoFunnel,
  "/dashboard/calls-trend": demoTrend,
  "/dashboard/followups/today": demoFollowupsToday,
  "/students": demoStudents,
  "/calls": demoCalls,
};
