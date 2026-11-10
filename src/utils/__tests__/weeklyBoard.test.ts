import { describe, expect, it, vi, afterEach } from "vitest";
import { buildWeekBoard, type BoardTask } from "@/utils/weeklyBoard";

const base = { project_id: "p1", project_code: "26LA001", project_name: "Picking", client_name: "ACME" };
const t = (id: string, over: Partial<BoardTask>): BoardTask => ({ id, task_name: id, status: "To Do", ...base, ...over });

// สัปดาห์ 2026-W46: จันทร์ 9 พ.ย. – อาทิตย์ 15 พ.ย.
const MONDAY = "2026-11-09";
const TODAY = "2026-11-10";

afterEach(() => vi.useRealTimers());

describe("buildWeekBoard", () => {
  it("places a multi-day task on each day it spans, marking start and due", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-10T10:00:00"));
    const board = buildWeekBoard([t("a", { status: "In Progress", start_date: "2026-11-10", due_date: "2026-11-12" })], MONDAY, TODAY);
    const kinds = board.days.map((d) => d.items.map((i) => i.kind).join(","));
    expect(kinds).toEqual(["", "start", "ongoing", "due", "", "", ""]);
    expect(board.counts.progress).toBe(1);
    expect(board.counts.all).toBe(1);
  });

  it("counts each task once even when it appears on several days", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-10T10:00:00"));
    const board = buildWeekBoard([t("a", { start_date: "2026-11-01", due_date: "2026-11-30" })], MONDAY, TODAY);
    expect(board.days.every((d) => d.items.length === 1)).toBe(true);
    expect(board.counts.all).toBe(1);
  });

  it("skips cancelled tasks, tasks without dates and tasks outside the week", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-10T10:00:00"));
    const board = buildWeekBoard(
      [
        t("cancel", { status: "Cancelled", start_date: "2026-11-10", due_date: "2026-11-10" }),
        t("nodate", {}),
        t("before", { start_date: "2026-10-01", due_date: "2026-10-05", status: "Done" }),
        t("after", { start_date: "2026-12-01", due_date: "2026-12-05" }),
      ],
      MONDAY,
      TODAY
    );
    expect(board.counts.all).toBe(0);
  });

  it("keeps an open overdue task on the board until today", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-12T10:00:00"));
    const board = buildWeekBoard([t("late", { status: "In Progress", start_date: "2026-11-02", due_date: "2026-11-09" })], MONDAY, "2026-11-12");
    expect(board.counts.overdue).toBe(1);
    const daysWithItem = board.days.filter((d) => d.items.length > 0).map((d) => d.date);
    expect(daysWithItem).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]);
  });

  it("shows a done task only up to its actual finish date", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-14T10:00:00"));
    const board = buildWeekBoard(
      [t("done", { status: "Done", start_date: "2026-11-09", due_date: "2026-11-13", update_date: "2026-11-10" })],
      MONDAY,
      "2026-11-14"
    );
    expect(board.counts.done).toBe(1);
    expect(board.days.filter((d) => d.items.length > 0).map((d) => d.date)).toEqual(["2026-11-09", "2026-11-10"]);
  });

  it("orders items overdue first, then in progress, then to do", () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-11-12T10:00:00"));
    const board = buildWeekBoard(
      [
        t("todo", { start_date: "2026-11-12", due_date: "2026-11-12" }),
        t("prog", { status: "In Progress", start_date: "2026-11-12", due_date: "2026-11-12" }),
        t("late", { status: "In Progress", start_date: "2026-11-05", due_date: "2026-11-06" }),
      ],
      MONDAY,
      "2026-11-12"
    );
    const thursday = board.days[3];
    expect(thursday.items.map((i) => i.task.id)).toEqual(["late", "prog", "todo"]);
  });
});
