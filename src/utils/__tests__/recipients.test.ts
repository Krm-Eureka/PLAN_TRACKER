import { describe, expect, it } from "vitest";
import { formatRecipients, isValidEmail, mergeRecipients, parseRecipients } from "@/utils/recipients";

describe("parseRecipients", () => {
  it("parses names with addresses and bare addresses", () => {
    expect(parseRecipients("Sukit J <sukit@x.co.th>, oratai <oratai@x.co.th>; plain@z.com")).toEqual([
      { name: "Sukit J", email: "sukit@x.co.th" },
      { name: "oratai", email: "oratai@x.co.th" },
      { name: "", email: "plain@z.com" },
    ]);
  });

  it("keeps commas inside quoted names (the old split-on-comma broke these)", () => {
    expect(parseRecipients('"Doe, John" <john@y.com>, a@b.com')).toEqual([
      { name: "Doe, John", email: "john@y.com" },
      { name: "", email: "a@b.com" },
    ]);
  });

  it("de-duplicates by email regardless of display name or case", () => {
    expect(parseRecipients("Ann <ann@x.com>, ANN@x.com, Annie <ann@X.com>")).toEqual([{ name: "Ann", email: "ann@x.com" }]);
  });

  it("handles Thai names and newlines", () => {
    expect(parseRecipients("วิศรุต สนองผัน <w@x.co.th>\nb@x.co.th")).toEqual([
      { name: "วิศรุต สนองผัน", email: "w@x.co.th" },
      { name: "", email: "b@x.co.th" },
    ]);
  });
});

describe("formatRecipients", () => {
  it("round-trips, quoting names that need it", () => {
    const list = [
      { name: "Doe, John", email: "john@y.com" },
      { name: "", email: "a@b.com" },
    ];
    const text = formatRecipients(list);
    expect(text).toBe('"Doe, John" <john@y.com>, a@b.com');
    expect(parseRecipients(text)).toEqual(list);
  });
});

describe("mergeRecipients", () => {
  it("merges lists, removes duplicates and excluded addresses", () => {
    const merged = mergeRecipients(
      [
        [{ name: "Me", email: "me@x.com" }, { name: "Ann", email: "ann@x.com" }],
        [{ name: "", email: "ANN@x.com" }, { name: "Bob", email: "bob@x.com" }],
      ],
      ["ME@x.com"]
    );
    expect(merged.map((r) => r.email)).toEqual(["ann@x.com", "bob@x.com"]);
  });
});

describe("isValidEmail", () => {
  it("accepts normal addresses and rejects junk", () => {
    expect(isValidEmail("a.b@company.co.th")).toBe(true);
    expect(isValidEmail("not an email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});
