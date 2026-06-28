/** تبدیل دوطرفه‌ی میلادی↔شمسی (الگوریتم استاندارد jalaali — بدون کتابخانه‌ی بیرونی).
 *
 * هم‌راستا با فلسفه‌ی پروژه (backend/src/shared/utils/jalali.py هم بدون وابستگی است).
 * این فایل پایه‌ی تقویم‌نمای شمسی (JalaliDatePicker) است.
 */

const div = (a: number, b: number) => ~~(a / b);
const mod = (a: number, b: number) => a - ~~(a / b) * b;

/** شمارهٔ روزِ مطلق میلادی (Julian-day-ish) از (سال، ماه، روز) میلادی. */
function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** (سال، ماه، روز) میلادی از شمارهٔ روزِ مطلق. */
function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm = 0;
  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): { jy: number; jm: number; jd: number } {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  let jm: number;
  let jd: number;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

/** (سال، ماه، روز) میلادی → شمسی. */
export function toJalaali(gy: number, gm: number, gd: number) {
  return d2j(g2d(gy, gm, gd));
}

/** (سال، ماه، روز) شمسی → میلادی. */
export function toGregorian(jy: number, jm: number, jd: number) {
  return d2g(j2d(jy, jm, jd));
}

export const J_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

export const J_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/** تعداد روزِ یک ماهِ شمسی (با احتساب کبیسه‌ی اسفند). */
export function daysInJMonth(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return jalCal(jy).leap === 0 ? 30 : 29;
}

/** ایندکسِ روزِ هفته‌ی اولِ ماهِ شمسی (۰=شنبه … ۶=جمعه). */
export function firstWeekdayOfJMonth(jy: number, jm: number): number {
  const g = toGregorian(jy, jm, 1);
  const dow = new Date(g.gy, g.gm - 1, g.gd).getDay(); // ۰=یکشنبه … ۶=شنبه
  return (dow + 1) % 7; // به مبنای شنبه=۰
}

/** رشتهٔ ISO میلادی ("YYYY-MM-DD") → (jy, jm, jd) یا null. */
export function isoToJalali(iso?: string | null) {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return toJalaali(+m[1], +m[2], +m[3]);
}

/** (jy, jm, jd) شمسی → رشتهٔ ISO میلادی "YYYY-MM-DD" (برای ارسال به بک‌اند). */
export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const g = toGregorian(jy, jm, jd);
  const mm = String(g.gm).padStart(2, "0");
  const dd = String(g.gd).padStart(2, "0");
  return `${g.gy}-${mm}-${dd}`;
}

/** شمسیِ امروز. */
export function todayJalali() {
  const n = new Date();
  return toJalaali(n.getFullYear(), n.getMonth() + 1, n.getDate());
}
