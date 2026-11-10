import { describe, expect, it } from "vitest";
import { isInternalPath, isInternalApiPath } from "@/lib/safeLink";
import { safeErrorMessage } from "@/lib/apiError";
import { isAdminRole } from "@/lib/roles";

describe("isInternalPath", () => {
  it.each(["/projects/1", "/calendar", "/tasks?id=2"])("accepts internal path %s", (p) => {
    expect(isInternalPath(p)).toBe(true);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/a b",
    "/a\nb",
    "",
    null,
    123,
  ])("rejects %s", (p) => {
    expect(isInternalPath(p)).toBe(false);
  });
});

describe("isInternalApiPath", () => {
  it("accepts /api/ paths", () => expect(isInternalApiPath("/api/tasks/1")).toBe(true));
  it("rejects traversal", () => expect(isInternalApiPath("/api/../projects")).toBe(false));
  it("rejects non-api paths", () => expect(isInternalApiPath("/projects")).toBe(false));
  it("rejects absolute URLs", () => expect(isInternalApiPath("https://x.com/api/a")).toBe(false));
});

describe("safeErrorMessage", () => {
  it("hides Prisma errors", () => {
    const err = Object.assign(new Error("Invalid `prisma.task.findUnique()` column secret"), {
      name: "PrismaClientKnownRequestError",
      code: "P2022",
    });
    expect(safeErrorMessage(err, "Failed")).toBe("Failed");
  });

  it("hides Postgres errors with SQLSTATE codes", () => {
    const err = Object.assign(new Error('relation "User" does not exist'), { code: "42P01" });
    expect(safeErrorMessage(err, "Failed")).toBe("Failed");
  });

  it("keeps application error messages", () => {
    expect(safeErrorMessage(new Error("Project Code already exists"), "Failed")).toBe("Project Code already exists");
  });

  it("falls back for non-errors", () => {
    expect(safeErrorMessage(undefined, "Failed")).toBe("Failed");
    expect(safeErrorMessage("boom", "Failed")).toBe("Failed");
  });
});

describe("isAdminRole", () => {
  it.each(["admin", "Admin", "superadmin", "Super Admin", "super_admin", "SUPER-ADMIN"])("treats %s as admin", (r) => {
    expect(isAdminRole(r)).toBe(true);
  });

  it.each(["Dept Admin Viewer", "administrator assistant", "manager", "member", "", null, undefined])(
    "does not treat %s as admin",
    (r) => {
      expect(isAdminRole(r)).toBe(false);
    }
  );
});
