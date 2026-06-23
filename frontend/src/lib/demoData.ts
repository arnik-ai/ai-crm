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
      city: "تهران", course: "تجربی", grade: "دوازدهم", goal: "پزشکی دانشگاه تهران",
      lead_source: "اینستاگرام", call_count: 4,
      lead_score: 78, stage: "مشاوره", last_call: "۲ ساعت پیش" },
    { id: "2", full_name: "علی رضایی", mobile: "+989352223344", status: "active",
      city: "اصفهان", course: "ریاضی", grade: "یازدهم", goal: "مهندسی کامپیوتر شریف",
      lead_source: "سایت", call_count: 2,
      lead_score: 52, stage: "علاقه‌مند", last_call: "دیروز" },
    { id: "3", full_name: "نگار حسینی", mobile: "+989019998877", status: "active",
      city: "شیراز", course: "تجربی", grade: "فارغ‌التحصیل", goal: "دندان‌پزشکی شهید بهشتی",
      lead_source: "تلگرام", call_count: 6,
      lead_score: 91, stage: "مذاکره", last_call: "۱ ساعت پیش" },
    { id: "4", full_name: "محمد کریمی", mobile: "+989127776655", status: "inactive",
      city: "مشهد", course: "انسانی", grade: "دهم", goal: "حقوق دانشگاه تهران",
      lead_source: "روبیکا", call_count: 1,
      lead_score: 33, stage: "تماس گرفته‌شده", last_call: "۵ روز پیش" },
    { id: "5", full_name: "زهرا اکبری", mobile: "+989364445566", status: "active",
      city: "تبریز", course: "ریاضی", grade: "دوازدهم", goal: "مهندسی برق امیرکبیر",
      lead_source: "پیامک", call_count: 3,
      lead_score: 67, stage: "علاقه‌مند", last_call: "۳ ساعت پیش" },
    { id: "6", full_name: "رضا قاسمی", mobile: "+989101112233", status: "active",
      city: "کرج", course: "انسانی", grade: "یازدهم", goal: "روان‌شناسی دانشگاه تهران",
      lead_source: "بله", call_count: 1,
      lead_score: 45, stage: "سرنخ جدید", last_call: "—" },
  ],
  total: 6,
  page: 1,
  size: 20,
};

export const demoCalls = {
  items: [
    { id: "1", direction: "inbound", status: "answered", outcome: "successful",
      student_name: "سارا محمدی", caller_number: "+989121234567",
      duration_sec: 372, started_at: "2026-06-21T08:30:00Z", lead_score: 78,
      summary: "علاقه‌مند به دوره‌ی تجربی؛ نگران شهریه است. پیشنهاد اقساط احتمال ثبت‌نام را بالا می‌برد.",
      signals: ["پرسیدن درباره‌ی اقساط", "درخواست مشاوره حضوری"], confidence: 0.92 },
    { id: "2", direction: "outbound", status: "answered", outcome: "follow_up",
      student_name: "علی رضایی", caller_number: "+989352223344",
      duration_sec: 145, started_at: "2026-06-21T09:15:00Z", lead_score: 52,
      summary: "تماس پیگیری؛ هنوز در حال تصمیم‌گیری بین دو مؤسسه است.",
      signals: ["مقایسه با رقبا"], confidence: 0.74 },
    { id: "3", direction: "inbound", status: "answered", outcome: "successful",
      student_name: "نگار حسینی", caller_number: "+989019998877",
      duration_sec: 521, started_at: "2026-06-21T10:05:00Z", lead_score: 91,
      summary: "سرنخ داغ! آماده‌ی ثبت‌نام برای دندان‌پزشکی؛ فقط منتظر هماهنگی زمان کلاس است.",
      signals: ["درخواست ثبت‌نام", "پرسیدن زمان شروع کلاس", "فوریت بالا"], confidence: 0.95 },
    { id: "4", direction: "inbound", status: "missed",
      student_name: "محمد کریمی", caller_number: "+989127776655",
      duration_sec: 0, started_at: "2026-06-21T11:40:00Z", lead_score: 33,
      summary: "تماس بی‌پاسخ — نیاز به پیگیری.",
      signals: [], confidence: 1 },
    { id: "5", direction: "outbound", status: "answered", outcome: "busy",
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

// گزارش روزانه‌ی تماس (مطابق اکسل کارفرما)
export const demoDailyReport = {
  date: "2026-06-22",
  inbound: 32,
  outbound: 48,
  missed: 7,
  successful: 14,
  unsuccessful: 9,
  busy: 3,
  follow_up: 11,
  total_calls: 80,
  total_minutes: 326.5,
};

// عملکرد کارشناسان فروش — برای پنل مدیر فروش (کی بیشتر فروخته)
export const demoTeam = {
  agents: [
    { id: "a1", full_name: "مریم رضایی", students: 124, calls: 412, sales_count: 31, sales_amount: 465_000_000 },
    { id: "a2", full_name: "حسین کریمی", students: 98, calls: 388, sales_count: 24, sales_amount: 360_000_000 },
    { id: "a3", full_name: "فاطمه احمدی", students: 110, calls: 356, sales_count: 19, sales_amount: 285_000_000 },
    { id: "a4", full_name: "علی موسوی", students: 76, calls: 290, sales_count: 12, sales_amount: 180_000_000 },
  ],
};

// جدول «عملکرد روز» — چند روز اخیر (مطابق عکس ۴ کارفرما)
export const demoDailyPerformance = {
  items: [
    { date: "2026-06-22", total: 80, sales: 5, customers: 34, successful: 14, busy: 3, unsuccessful: 9, not_handled: 6, missed: 7, follow_up: 11, minutes: 326.5 },
    { date: "2026-06-21", total: 72, sales: 3, customers: 29, successful: 11, busy: 5, unsuccessful: 8, not_handled: 8, missed: 6, follow_up: 9, minutes: 298.0 },
    { date: "2026-06-20", total: 91, sales: 7, customers: 41, successful: 18, busy: 2, unsuccessful: 12, not_handled: 5, missed: 9, follow_up: 14, minutes: 372.5 },
    { date: "2026-06-19", total: 64, sales: 2, customers: 24, successful: 9, busy: 4, unsuccessful: 7, not_handled: 9, missed: 5, follow_up: 8, minutes: 254.0 },
    { date: "2026-06-18", total: 78, sales: 4, customers: 32, successful: 13, busy: 3, unsuccessful: 10, not_handled: 7, missed: 8, follow_up: 12, minutes: 311.5 },
    { date: "2026-06-17", total: 55, sales: 1, customers: 19, successful: 7, busy: 6, unsuccessful: 5, not_handled: 11, missed: 4, follow_up: 6, minutes: 210.0 },
    { date: "2026-06-16", total: 83, sales: 6, customers: 37, successful: 15, busy: 2, unsuccessful: 11, not_handled: 4, missed: 7, follow_up: 13, minutes: 340.0 },
  ],
};

// لیست فروش (فیش‌ها) — محصولات مطابق فهرست کارفرما
export const demoSales = {
  items: [
    { id: "s1", student_name: "مریم ابراهیمی", mobile: "+989121110011", date: "2026-06-17T10:00:00Z", product: "برنامه", program_months: 6, amount: 18_500_000, payment: "کارت به کارت", payment_ref: "۶۲۱۹۸۶...۴۵", renewal_due: "2026-12-17T10:00:00Z" },
    { id: "s2", student_name: "علی محمدی", mobile: "+989122220022", date: "2026-06-15T10:00:00Z", product: "جهش", program_months: null, amount: 9_800_000, payment: "اقساط", payment_ref: null, renewal_due: null },
    { id: "s3", student_name: "زهرا کریمی", mobile: "+989123330033", date: "2026-06-14T10:00:00Z", product: "بمب دوازدهم", program_months: null, amount: 4_500_000, payment: "کارت به کارت", payment_ref: "۶۰۳۷۹۹...۱۲", renewal_due: null },
    { id: "s4", student_name: "رضا حسینی", mobile: "+989124440044", date: "2026-06-12T10:00:00Z", product: "برنامه", program_months: 3, amount: 6_200_000, payment: "درگاه آنلاین", payment_ref: "TRK-88231", renewal_due: "2026-09-12T10:00:00Z" },
    { id: "s5", student_name: "نگار رضایی", mobile: "+989125550055", date: "2026-06-10T10:00:00Z", product: "شبیه ساز", program_months: null, amount: 12_000_000, payment: "اقساط", payment_ref: null, renewal_due: null },
  ],
  total_amount: 51_000_000,
  count: 5,
};

// متادیتای فرم ثبت فیش (محصولات/پرداخت/مدت برنامه)
export const demoSalesMeta = {
  products: [
    "بمب دهم", "بمب یازدهم", "بمب دوازدهم", "جهش", "شبیه ساز", "روش مطالعه",
    "مصاحبه فرهنگیان", "منابع فرهنگیان", "آموزش انتخاب رشته", "انتخاب رشته",
    "پامپ", "تک جلسه", "برنامه",
  ],
  payment_methods: ["کارت به کارت", "اقساط", "درگاه آنلاین", "نقدی"],
  program_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

// پیگیری‌ها (مطابق عکس ۵ کارفرما)
export const demoFollowups = {
  items: [
    { id: "p1", date: "1405/03/27", student_name: "امیرمحمد فتاحی", mobile: "+989121234501", next_call: "1405/03/30", note: "پیشنهاد بسته جهش" },
    { id: "p2", date: "1405/03/26", student_name: "حدیث محمدی", mobile: "+989121234502", next_call: "1405/03/28", note: "خرید قسطی" },
    { id: "p3", date: "1405/03/26", student_name: "راشد دوشنبه‌زاده", mobile: "+989121234503", next_call: "1405/03/29", note: "برای برنامه پیگیری باشم" },
    { id: "p4", date: "1405/03/25", student_name: "امیرمعصوم صالح", mobile: "+989121234504", next_call: "1405/04/01", note: "با مادر صحبت کردم، جواب نداد" },
    { id: "p5", date: "1405/03/24", student_name: "معصومه نظری", mobile: "+989121234505", next_call: "1405/03/31", note: "لیسانس شیمی، هدف فرهنگیان" },
  ],
};

// عملکرد نیرو در طول ماه — امتیاز و سطح هر کارشناس به تفکیک ماه (مطابق عکس ۱)
export const demoMonthlyPerformance = {
  months: ["1405-04", "1405-03", "1405-02"],
  agents: [
    {
      id: "a1", full_name: "مریم رضایی", avg_score: 78.3, level: "خوب",
      months: {
        "1405-04": { calls: 312, minutes: 642, sales: 18, followups: 41, score: 82.5, level: "خوب" },
        "1405-03": { calls: 288, minutes: 598, sales: 15, followups: 38, score: 76.0, level: "خوب" },
        "1405-02": { calls: 264, minutes: 553, sales: 13, followups: 35, score: 76.4, level: "خوب" },
      },
    },
    {
      id: "a2", full_name: "حسین کریمی", avg_score: 61.7, level: "قابل قبول",
      months: {
        "1405-04": { calls: 245, minutes: 510, sales: 11, followups: 29, score: 64.2, level: "قابل قبول" },
        "1405-03": { calls: 231, minutes: 487, sales: 9, followups: 26, score: 58.5, level: "قابل قبول" },
        "1405-02": { calls: 252, minutes: 521, sales: 10, followups: 31, score: 62.4, level: "قابل قبول" },
      },
    },
    {
      id: "a3", full_name: "فاطمه احمدی", avg_score: 54.0, level: "قابل قبول",
      months: {
        "1405-04": { calls: 198, minutes: 432, sales: 8, followups: 22, score: 52.1, level: "قابل قبول" },
        "1405-03": { calls: 210, minutes: 455, sales: 9, followups: 25, score: 56.8, level: "قابل قبول" },
        "1405-02": { calls: 187, minutes: 401, sales: 7, followups: 20, score: 53.1, level: "قابل قبول" },
      },
    },
    {
      id: "a4", full_name: "علی موسوی", avg_score: 33.2, level: "ضعیف",
      months: {
        "1405-04": { calls: 134, minutes: 268, sales: 4, followups: 12, score: 31.5, level: "ضعیف" },
        "1405-03": { calls: 142, minutes: 290, sales: 5, followups: 14, score: 35.8, level: "ضعیف" },
        "1405-02": { calls: 128, minutes: 255, sales: 3, followups: 11, score: 32.3, level: "ضعیف" },
      },
    },
  ],
};

// کاربران سیستم (اعضای تیم) — برای پنل مدیریت کاربران
export const demoUsers = [
  { id: "u1", full_name: "مدیر سیستم", mobile: "+989120000000", email: "admin@crm.local", is_active: true, roles: ["admin"] },
  { id: "u2", full_name: "مریم رضایی", mobile: "+989121111111", email: "989121111111@otp.local", is_active: true, roles: ["sales_manager"] },
  { id: "u3", full_name: "حسین کریمی", mobile: "+989122222222", email: "989122222222@otp.local", is_active: true, roles: ["sales_agent"] },
  { id: "u4", full_name: "فاطمه احمدی", mobile: "+989123333333", email: "989123333333@otp.local", is_active: true, roles: ["sales_agent"] },
  { id: "u5", full_name: "علی موسوی", mobile: "+989124444444", email: "989124444444@otp.local", is_active: false, roles: ["sales_agent"] },
];

/** نگاشت مسیر API → داده‌ی دموی متناظر. */
export const demoByPath: Record<string, unknown> = {
  "/dashboard/summary": demoSummary,
  "/dashboard/funnel": demoFunnel,
  "/dashboard/calls-trend": demoTrend,
  "/dashboard/followups/today": demoFollowupsToday,
  "/dashboard/daily-report": demoDailyReport,
  "/dashboard/daily-performance": demoDailyPerformance,
  "/dashboard/monthly-performance": demoMonthlyPerformance,
  "/dashboard/team": demoTeam,
  "/students": demoStudents,
  "/calls": demoCalls,
  "/sales": demoSales,
  "/sales/meta": demoSalesMeta,
  "/followups": demoFollowups,
  "/users": demoUsers,
};
