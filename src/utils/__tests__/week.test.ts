import { describe, expect, it } from "vitest";
import {
  addDays,
  formatWeekKey,
  getIsoWeek,
  mondayOfIsoWeek,
  parseWeekKey,
  startOfIsoWeek,
  weekDays,
} from "@/utils/week";

describe("getIsoWeek", () => {
  it.each([
    ["2026-11-10", 2026, 46],
    ["2026-10-26", 2026, 44],
    ["2026-12-28", 2026, 53], // 2026 has 53 ISO weeks
    ["2027-01-03", 2026, 53], // still week 53 of 2026
    ["2027-01-04", 2027, 1], // Monday of week 1 (the Netlify page labels this W2)
    ["2027-01-11", 2027, 2],
    ["2024-12-30", 2025, 1], // late-December date that belongs to next year's week 1
    ["2021-01-01", 2020, 53],
  ])("%s → %i-W%i", (date, year, week) => {
    expect(getIsoWeek(date)).toEqual({ year, week });
  });
});

describe("week boundaries", () => {
  it("startOfIsoWeek returns Monday", () => {
    expect(startOfIsoWeek("2026-11-10")).toBe("2026-11-09");
    expect(startOfIsoWeek("2026-11-15")).toBe("2026-11-09"); // Sunday
    expect(startOfIsoWeek("2026-11-16")).toBe("2026-11-16"); // Monday
  });

  it("mondayOfIsoWeek round-trips with getIsoWeek", () => {
    expect(mondayOfIsoWeek({ year: 2027, week: 1 })).toBe("2027-01-04");
    expect(mondayOfIsoWeek({ year: 2026, week: 53 })).toBe("2026-12-28");
    expect(mondayOfIsoWeek({ year: 2026, week: 46 })).toBe("2026-11-09");
  });

  it("weekDays lists Monday..Sunday across month/year ends", () => {
    expect(weekDays("2026-12-28")).toEqual([
      "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
    ]);
  });

  it("addDays handles negative offsets", () => {
    expect(addDays("2027-01-04", -7)).toBe("2026-12-28");
  });
});

describe("week keys", () => {
  it("formats and parses", () => {
    expect(formatWeekKey({ year: 2026, week: 6 })).toBe("2026-W06");
    expect(parseWeekKey("2026-W46")).toEqual({ year: 2026, week: 46 });
    expect(parseWeekKey("2026-W06")).toEqual({ year: 2026, week: 6 });
  });

  it("rejects invalid keys, including W53 in a 52-week year", () => {
    expect(parseWeekKey("2027-W53")).toBeNull();
    expect(parseWeekKey("2026-W00")).toBeNull();
    expect(parseWeekKey("garbage")).toBeNull();
    expect(parseWeekKey(undefined)).toBeNull();
  });
});
