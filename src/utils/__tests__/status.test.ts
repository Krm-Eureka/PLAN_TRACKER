import { describe, expect, it } from "vitest";
import { normalizeTaskStatus } from "@/constants/status";

describe("normalizeTaskStatus", () => {
  it.each([
    ["Hold", "On Hold"],
    ["On Hold", "On Hold"],
    ["in progress", "In Progress"],
    ["Done", "Done"],
    ["completed", "Done"],
    ["Cancelled", "Cancel"],
    ["Review", "Review"],
    ["To Do", "To Do"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeTaskStatus(input)).toBe(expected);
  });

  it("rejects unknown or empty values", () => {
    expect(normalizeTaskStatus("")).toBeNull();
    expect(normalizeTaskStatus("banana")).toBeNull();
  });
});
