import { describe, expect, it } from "vitest";
import { meetingsByDay, monthsInRange, plansByDay } from "@/utils/calendarLayers";

const names: Record<string, string> = { u1: "Ann", u2: "Bob", u3: "Cat" };
const nameOf = (id: string) => names[id];

describe("plansByDay", () => {
  it("spreads a multi-day plan and resolves companion names", () => {
    const map = plansByDay(
      [{ id: "p1", name: "Ann", start_date: "2026-11-09", duration_days: "3", companions: "u2, u3", location: "Site A" }],
      nameOf
    );
    expect([...map.keys()]).toEqual(["2026-11-09", "2026-11-10", "2026-11-11"]);
    expect(map.get("2026-11-09")![0]).toMatchObject({ people: ["Ann", "Bob", "Cat"], isFirstDay: true });
    expect(map.get("2026-11-10")![0].isFirstDay).toBe(false);
  });

  it("defaults to one day, falls back to owner id lookup and skips bad dates", () => {
    const map = plansByDay(
      [
        { id: "p1", user_id: "u1", start_date: "2026-11-10", duration_days: null },
        { id: "bad", start_date: "not-a-date" },
      ],
      nameOf
    );
    expect([...map.keys()]).toEqual(["2026-11-10"]);
    expect(map.get("2026-11-10")![0].people).toEqual(["Ann"]);
  });

  it("caps runaway durations", () => {
    const map = plansByDay([{ id: "p", name: "Ann", start_date: "2026-01-01", duration_days: "999" }], nameOf);
    expect(map.size).toBe(31);
  });
});

describe("meetingsByDay", () => {
  it("places timed meetings on their local date with HH:MM and de-duplicates", () => {
    const start = new Date(2026, 10, 10, 9, 30).toISOString();
    const m = { id: "m1", summary: "Standup", start, end: start, isAllDay: false };
    const map = meetingsByDay([m, { ...m }]);
    expect(map.get("2026-11-10")).toEqual([{ meeting: m, time: "09:30" }]);
  });

  it("spreads all-day events using Google's exclusive end date", () => {
    const map = meetingsByDay([{ id: "h", summary: "Holiday", start: "2026-12-31", end: "2027-01-02", isAllDay: true }]);
    expect([...map.keys()]).toEqual(["2026-12-31", "2027-01-01"]);
    expect(map.get("2026-12-31")![0].time).toBeNull();
  });
});

describe("monthsInRange", () => {
  it("covers ranges across a year boundary", () => {
    expect(monthsInRange("2026-12-28", "2027-01-03")).toEqual(["2026-12", "2027-01"]);
    expect(monthsInRange("2026-11-09", "2026-11-15")).toEqual(["2026-11"]);
  });
});

describe("meetingsByDay edge cases", () => {
  it("shows an all-day event whose end equals its start on the start day", () => {
    const map = meetingsByDay([{ id: "x", summary: "Odd", start: "2026-11-10T00:00:00.000Z", end: "2026-11-10T00:00:00.000Z", isAllDay: true }]);
    expect([...map.keys()]).toEqual(["2026-11-10"]);
  });
});
