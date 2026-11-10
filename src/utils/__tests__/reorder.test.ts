import { describe, expect, it } from "vitest";
import { computeReorder } from "@/utils/reorder";

const tasks = () => [
  { id: "a", parent_task_id: null, task_order: "1" },
  { id: "b", parent_task_id: null, task_order: "2" },
  { id: "b1", parent_task_id: "b", task_order: "2.1" },
  { id: "b2", parent_task_id: "b", task_order: "2.2" },
  { id: "c", parent_task_id: null, task_order: "3" },
];

describe("computeReorder", () => {
  it("moves a task down and renumbers its children", () => {
    const r = computeReorder(tasks(), "a", "c");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.fromEntries(r.orderMap)).toEqual({ b: "1", b1: "1.1", b2: "1.2", c: "2", a: "3" });
  });

  it("moves a task up", () => {
    const r = computeReorder(tasks(), "c", "a");
    if (!r.ok) throw new Error("expected ok");
    expect(r.orderMap.get("c")).toBe("1");
    expect(r.orderMap.get("a")).toBe("2");
    expect(r.orderMap.get("b1")).toBe("3.1");
  });

  it("returns only tasks whose order changed", () => {
    const r = computeReorder(tasks(), "b1", "b2");
    if (!r.ok) throw new Error("expected ok");
    expect(r.updates).toEqual([
      { id: "b1", task_order: "2.2" },
      { id: "b2", task_order: "2.1" },
    ]);
  });

  it("does not mutate the input", () => {
    const input = tasks();
    const snapshot = JSON.stringify(input);
    computeReorder(input, "a", "c");
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("refuses moves across different parents", () => {
    expect(computeReorder(tasks(), "b1", "a")).toEqual({ ok: false, reason: "different-parent" });
  });

  it("handles dropping on itself and unknown ids", () => {
    expect(computeReorder(tasks(), "a", "a")).toEqual({ ok: false, reason: "same" });
    expect(computeReorder(tasks(), "a", "zzz")).toEqual({ ok: false, reason: "missing" });
  });

  it("orders numerically (10 after 9) and puts unnumbered tasks last", () => {
    const list = [
      { id: "x10", parent_task_id: null, task_order: "10" },
      { id: "x9", parent_task_id: null, task_order: "9" },
      { id: "none", parent_task_id: null, task_order: null },
    ];
    const r = computeReorder(list, "x9", "x10");
    if (!r.ok) throw new Error("expected ok");
    expect(Object.fromEntries(r.orderMap)).toEqual({ x10: "1", x9: "2", none: "3" });
  });
});
