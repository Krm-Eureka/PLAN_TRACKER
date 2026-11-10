import { isCancelStatus, isDoneStatus, isHoldStatus, isProgressStatus, isReviewStatus } from "@/constants/status";
import { isTaskOverdue } from "@/utils/status";
import { isValidDateStr, weekDays } from "@/utils/week";

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
}

export interface BoardItem {
  task: BoardTask;
  category: BoardCategory;
  /** วันนี้เป็นวันเริ่ม / วันกำหนดส่ง / ระหว่างทำ */
  kind: "start" | "due" | "ongoing" | "single";
}

export interface WeekBoard {
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

export function buildWeekBoard(tasks: BoardTask[], monday: string, today: string): WeekBoard {
  const days = weekDays(monday).map((date) => ({ date, items: [] as BoardItem[] }));
  const sunday = days[6].date;
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
