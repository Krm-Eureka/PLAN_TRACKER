import { isCancelStatus, isDoneStatus, isHoldStatus, isProgressStatus, isReviewStatus } from "@/constants/status";
import { isTaskOverdue } from "@/utils/status";
import { addDays, isValidDateStr, weekDays } from "@/utils/week";
import type { TaskTypeKey } from "@/constants/taskTypes";

export type BoardCategory = "overdue" | "progress" | "review" | "todo" | "hold" | "done";

export const BOARD_CATEGORIES: { key: BoardCategory; label: string }[] = [
  { key: "overdue", label: "เลยกำหนด" },
  { key: "progress", label: "กำลังทำ" },
  { key: "review", label: "รอตรวจ" },
  { key: "todo", label: "ยังไม่เริ่ม" },
  { key: "hold", label: "พักไว้" },
  { key: "done", label: "เสร็จแล้ว" },
];

export interface BoardTask {
  id: string;
  task_name: string;
  status: string;
  start_date?: string | null;
  due_date?: string | null;
  update_date?: string | null;
  assignee_name?: string | null;
  project_id: string;
  project_code?: string | null;
  project_name?: string | null;
  client_name?: string | null;
  task_type?: TaskTypeKey | null;
}

export interface BoardItem {
  task: BoardTask;
  category: BoardCategory;
  /** วันนี้เป็นวันเริ่ม / วันกำหนดส่ง / ระหว่างทำ */
  kind: "start" | "due" | "ongoing" | "single";
}

export interface RangeBoard {
  days: { date: string; items: BoardItem[] }[];
  /** จำนวน task (ไม่ซ้ำ) ในสัปดาห์ แยกตามสถานะ */
  counts: Record<BoardCategory | "all", number>;
  projectCount: number;
}

export function categorize(task: BoardTask): BoardCategory {
  if (isTaskOverdue(task.status, task.due_date ?? undefined)) return "overdue";
  if (isDoneStatus(task.status)) return "done";
  if (isHoldStatus(task.status)) return "hold";
  if (isReviewStatus(task.status)) return "review";
  if (isProgressStatus(task.status)) return "progress";
  return "todo";
}

/** ช่วงวันที่ task ครอบคลุมบนบอร์ด หรือ null ถ้าไม่มีวันที่ */
export function taskSpan(task: BoardTask, category: BoardCategory, today: string): { start: string; end: string } | null {
  const start = isValidDateStr(task.start_date) ? task.start_date.slice(0, 10) : null;
  const due = isValidDateStr(task.due_date) ? task.due_date.slice(0, 10) : null;
  const finished = isValidDateStr(task.update_date) ? task.update_date.slice(0, 10) : null;

  let s = start || due;
  let e = due || start;
  if (!s || !e) return null;

  if (category === "done" && finished) e = finished; // งานเสร็จ: แสดงถึงวันที่เสร็จจริง
  if (category === "overdue" && today > e) e = today; // งานเลยกำหนดที่ยังไม่เสร็จ: ค้างบนบอร์ดจนถึงวันนี้
  if (s > e) [s, e] = [e, s];
  return { start: s, end: e };
}

/** @deprecated ใช้ RangeBoard */
export type WeekBoard = RangeBoard;

/** วันที่ทุกวันตั้งแต่ start ถึง end (รวมทั้งสองวัน) */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

export function buildWeekBoard(tasks: BoardTask[], monday: string, today: string): RangeBoard {
  return buildRangeBoard(tasks, weekDays(monday), today);
}

/** สร้างบอร์ดสำหรับชุดวันที่ใดก็ได้ (สัปดาห์ / เดือน) ใช้กฎเดียวกันทั้งหมด */
export function buildRangeBoard(tasks: BoardTask[], dates: string[], today: string): RangeBoard {
  const days = dates.map((date) => ({ date, items: [] as BoardItem[] }));
  const monday = dates[0];
  const sunday = dates[dates.length - 1];
  const seen = new Map<string, BoardCategory>();
  const projects = new Set<string>();

  for (const task of tasks) {
    if (isCancelStatus(task.status)) continue;
    const category = categorize(task);
    const span = taskSpan(task, category, today);
    if (!span || span.end < monday || span.start > sunday) continue;

    seen.set(task.id, category);
    projects.add(task.project_id);
    const due = isValidDateStr(task.due_date) ? task.due_date.slice(0, 10) : null;

    for (const day of days) {
      if (day.date < span.start || day.date > span.end) continue;
      const kind: BoardItem["kind"] =
        span.start === span.end ? "single" : day.date === span.start ? "start" : day.date === due ? "due" : "ongoing";
      day.items.push({ task, category, kind });
    }
  }

  const order: Record<BoardCategory, number> = { overdue: 0, progress: 1, review: 2, todo: 3, hold: 4, done: 5 };
  for (const day of days) {
    day.items.sort(
      (a, b) =>
        order[a.category] - order[b.category] ||
        String(a.task.project_code || "").localeCompare(String(b.task.project_code || "")) ||
        a.task.task_name.localeCompare(b.task.task_name)
    );
  }

  const counts = { all: seen.size, overdue: 0, progress: 0, review: 0, todo: 0, hold: 0, done: 0 };
  for (const c of seen.values()) counts[c]++;

  return { days, counts, projectCount: projects.size };
}

// ---------------------------------------------------------------------------
// Workload: คน × วัน = จำนวนงานที่ยังไม่เสร็จในวันนั้น
// ---------------------------------------------------------------------------

export const UNASSIGNED = "(ยังไม่มีผู้รับผิดชอบ)";

export interface WorkloadRow {
  person: string;
  /** จำนวนงานที่ยังไม่เสร็จต่อวัน เรียงตาม dates */
  perDay: number[];
  /** งานไม่ซ้ำที่ยังไม่เสร็จในช่วงนี้ */
  openTasks: number;
  overdueTasks: number;
  /** วันที่มีงานพร้อมกันมากที่สุด */
  peak: number;
}

export function splitAssignees(names?: string | null): string[] {
  const list = String(names || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  return list.length > 0 ? list : [UNASSIGNED];
}

export function buildWorkload(board: RangeBoard): WorkloadRow[] {
  const rows = new Map<string, { perDay: number[]; open: Set<string>; overdue: Set<string> }>();
  const dayCount = board.days.length;

  board.days.forEach((day, i) => {
    for (const item of day.items) {
      if (item.category === "done") continue;
      for (const person of splitAssignees(item.task.assignee_name)) {
        let row = rows.get(person);
        if (!row) {
          row = { perDay: new Array(dayCount).fill(0), open: new Set(), overdue: new Set() };
          rows.set(person, row);
        }
        row.perDay[i]++;
        row.open.add(item.task.id);
        if (item.category === "overdue") row.overdue.add(item.task.id);
      }
    }
  });

  return [...rows.entries()]
    .map(([person, r]) => ({
      person,
      perDay: r.perDay,
      openTasks: r.open.size,
      overdueTasks: r.overdue.size,
      peak: Math.max(0, ...r.perDay),
    }))
    .sort((a, b) =>
      a.person === UNASSIGNED ? 1 : b.person === UNASSIGNED ? -1 : b.peak - a.peak || b.openTasks - a.openTasks || a.person.localeCompare(b.person)
    );
}
