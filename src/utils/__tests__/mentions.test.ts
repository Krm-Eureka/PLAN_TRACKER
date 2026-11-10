import { describe, expect, it } from "vitest";
import { findMentionedUserIds } from "@/utils/mentions";

const users = [
  { id: "u1", name_en: "Witsarut Sanongphun", name_th: "วิศรุต สนองผัน", emp_id: "E001" },
  { id: "u2", name_en: "Somchai", name_th: "สมชาย", emp_id: "E002" },
  { id: "u3", name_en: "Somchai Jaidee", name_th: "สมชาย ใจดี", emp_id: "E003" },
  { id: "u4", name_en: "Ann", name_th: null, emp_id: "E004" },
];

describe("findMentionedUserIds", () => {
  it("matches full English names with spaces", () => {
    expect(findMentionedUserIds("ฝาก @Witsarut Sanongphun ช่วยดู", users)).toEqual(["u1"]);
  });

  it("matches Thai names", () => {
    expect(findMentionedUserIds("@วิศรุต สนองผัน รับทราบ", users)).toEqual(["u1"]);
  });

  it("prefers the longest name (Somchai Jaidee, not Somchai)", () => {
    expect(findMentionedUserIds("hi @Somchai Jaidee", users)).toEqual(["u3"]);
  });

  it("still matches the short name when used alone", () => {
    expect(findMentionedUserIds("hi @Somchai, please check", users)).toEqual(["u2"]);
  });

  it("does not match a prefix of a longer word", () => {
    expect(findMentionedUserIds("@Anna is not Ann", users)).toEqual([]);
  });

  it("finds several people and is case-insensitive", () => {
    expect(findMentionedUserIds("@ann and @e002", users).sort()).toEqual(["u2", "u4"]);
  });

  it("returns nothing without @", () => {
    expect(findMentionedUserIds("no mentions here", users)).toEqual([]);
  });
});
