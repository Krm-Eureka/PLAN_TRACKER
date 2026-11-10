import { addDays, isValidDateStr, todayStr } from "@/utils/week";

/** แผนงาน (ไปหน้างาน / WFH / ลา) ตามรูปแบบที่ /api/plans ส่งมา */
export interface RawPlan {
  id: string;
  user_id?: string | null;
  name?: string | null;
  start_date?: string | null;
  duration_days?: string | number | null;
  location?: string | null;
  plan_detail?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  companions?: string | null;
  project_id?: string | null;
  task_id?: string | null;
}

/** ประชุมจาก Google Calendar ตามรูปแบบที่ /api/calendar/events ส่งมา */
export interface RawMeeting {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  isAllDay: boolean;
  location?: string | null;
  hangoutLink?: string | null;
  htmlLink?: string | null;
  source?: "personal" | "group";
}

export interface DayPlan {
  plan: RawPlan;
  people: string[];
  /** วันแรกของแผนหลายวัน */
  isFirstDay: boolean;
}

export interface DayMeeting {
  meeting: RawMeeting;
  /** "09:30" หรือ null ถ้าทั้งวัน */
  time: string | null;
}

const MAX_PLAN_DAYS = 31;

/** กระจายแผนลงแต่ละวันตาม start_date + duration_days */
export function plansByDay(plans: RawPlan[], nameOf: (id: string) => string | undefined): Map<string, DayPlan[]> {
  const out = new Map<string, DayPlan[]>();
  for (const plan of plans) {
    if (!isValidDateStr(plan.start_date)) continue;
    const start = plan.start_date.slice(0, 10);
    const days = Math.min(MAX_PLAN_DAYS, Math.max(1, parseInt(String(plan.duration_days ?? "1"), 10) || 1));
    const companions = String(plan.companions || "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((id) => nameOf(id) || id);
    const people = [plan.name || (plan.user_id ? nameOf(plan.user_id) : "") || "—", ...companions];
    for (let i = 0; i < days; i++) {
      const date = addDays(start, i);
      const list = out.get(date) ?? [];
      list.push({ plan, people, isFirstDay: i === 0 });
      out.set(date, list);
    }
  }
  for (const list of out.values()) {
    list.sort((a, b) => String(a.plan.start_time || "99").localeCompare(String(b.plan.start_time || "99")));
  }
  return out;
}

function localDateOf(iso: string): string {
  return todayStr(new Date(iso));
}

function localTimeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** กระจายประชุมลงวัน (ประชุมทั้งวันหลายวัน: end ของ Google เป็นวันถัดไปแบบ exclusive) */
export function meetingsByDay(meetings: RawMeeting[]): Map<string, DayMeeting[]> {
  const out = new Map<string, DayMeeting[]>();
  const seen = new Set<string>();
  const push = (date: string, m: DayMeeting) => {
    const list = out.get(date) ?? [];
    list.push(m);
    out.set(date, list);
  };
  for (const m of meetings) {
    if (!m.start) continue;
    // ปฏิทินส่วนตัวกับปฏิทินกลุ่มอาจมีนัดเดียวกันซ้ำ
    const key = `${m.id}|${m.start}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (m.isAllDay) {
      const start = m.start.slice(0, 10);
      // end ของ Google เป็น exclusive; ถ้าข้อมูล end ≤ start (ข้อมูลผิด/ไม่มี) ให้แสดงอย่างน้อยวันเริ่ม
      const rawEnd = m.end ? m.end.slice(0, 10) : "";
      const endExclusive = rawEnd > start ? rawEnd : addDays(start, 1);
      for (let d = start, n = 0; d < endExclusive && n < MAX_PLAN_DAYS; d = addDays(d, 1), n++) {
        push(d, { meeting: m, time: null });
      }
    } else {
      push(localDateOf(m.start), { meeting: m, time: localTimeOf(m.start) });
    }
  }
  for (const list of out.values()) {
    list.sort((a, b) => (a.time ?? "00:00").localeCompare(b.time ?? "00:00"));
  }
  return out;
}

/** เดือน (YYYY-MM) ทั้งหมดที่ช่วงวันที่ครอบคลุม — ใช้ตัดสินใจว่าจะโหลดแผน/ประชุมเดือนไหน */
export function monthsInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  const endKey = end.slice(0, 7);
  for (let i = 0; i < 24; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key >= endKey) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
