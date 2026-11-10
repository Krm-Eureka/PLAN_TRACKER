/**
 * ISO-8601 week utilities ทำงานกับวันที่แบบ "YYYY-MM-DD" (ไม่มีเวลา/โซนเวลา)
 * ใช้ UTC ภายในเพื่อไม่ให้ค่าเพี้ยนตาม timezone ของเครื่อง
 * - สัปดาห์เริ่มวันจันทร์
 * - สัปดาห์ที่ 1 คือสัปดาห์ที่มีวันพฤหัสแรกของปี (= สัปดาห์ที่มีวันที่ 4 ม.ค.)
 */

const DAY_MS = 86_400_000;

export interface IsoWeek {
  year: number;
  week: number;
}

function toUtc(dateStr: string): number {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function toDateStr(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

/** วันนี้ตามเวลาท้องถิ่นของผู้ใช้ ในรูป YYYY-MM-DD */
export function todayStr(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidDateStr(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) && !isNaN(toUtc(s));
}

export function addDays(dateStr: string, days: number): string {
  return toDateStr(toUtc(dateStr) + days * DAY_MS);
}

/** 1 = จันทร์ ... 7 = อาทิตย์ */
function isoWeekday(utcMs: number): number {
  const d = new Date(utcMs).getUTCDay();
  return d === 0 ? 7 : d;
}

export function getIsoWeek(dateStr: string): IsoWeek {
  const t = toUtc(dateStr);
  // เลื่อนไปวันพฤหัสของสัปดาห์เดียวกัน — ปีของวันพฤหัสคือปีของสัปดาห์
  const thursday = t + (4 - isoWeekday(t)) * DAY_MS;
  const year = new Date(thursday).getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const week = Math.floor((thursday - jan1) / DAY_MS / 7) + 1;
  return { year, week };
}

/** วันจันทร์ของสัปดาห์ที่มีวันนี้ */
export function startOfIsoWeek(dateStr: string): string {
  const t = toUtc(dateStr);
  return toDateStr(t - (isoWeekday(t) - 1) * DAY_MS);
}

/** วันจันทร์ของ ISO week ที่ระบุ */
export function mondayOfIsoWeek({ year, week }: IsoWeek): string {
  const jan4 = Date.UTC(year, 0, 4);
  const week1Monday = jan4 - (isoWeekday(jan4) - 1) * DAY_MS;
  return toDateStr(week1Monday + (week - 1) * 7 * DAY_MS);
}

export function formatWeekKey({ year, week }: IsoWeek): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** "2026-W46" → { year: 2026, week: 46 } หรือ null ถ้ารูปแบบผิด */
export function parseWeekKey(key: string | null | undefined): IsoWeek | null {
  const m = /^(\d{4})-W(\d{1,2})$/.exec(String(key || "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  // ปีที่มีแค่ 52 สัปดาห์ W53 จะไม่มีจริง
  if (getIsoWeek(mondayOfIsoWeek({ year, week })).week !== week) return null;
  return { year, week };
}

/** วันจันทร์–อาทิตย์ของสัปดาห์ */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
