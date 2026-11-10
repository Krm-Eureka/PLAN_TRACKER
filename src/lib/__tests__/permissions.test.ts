import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- fixtures: 2 แผนก, ผู้ใช้ 4 คน, role 3 ระดับ ----
const roles = [
  { role_name: "admin", view_scope: "GLOBAL", project_edit_scope: "GLOBAL", task_edit_scope: "GLOBAL", user_manage_scope: "GLOBAL" },
  { role_name: "manager", view_scope: "DEPT", project_edit_scope: "DEPT", task_edit_scope: "DEPT", user_manage_scope: "NONE" },
  { role_name: "member", view_scope: "OWNED", project_edit_scope: "OWNED", task_edit_scope: "OWNED", user_manage_scope: "NONE" },
];
const users = [
  { id: "u-admin", email: "admin@co.th", department_id: "IT", emp_id: "1" },
  { id: "u-mgr-it", email: "mgr@co.th", department_id: "IT", emp_id: "2" },
  { id: "u-mem-it", email: "mem@co.th", department_id: "IT", emp_id: "3" },
  { id: "u-mem-hr", email: "hr@co.th", department_id: "HR", emp_id: "4" },
];
const departments = [
  { id: "d-it", department_id: "IT", department_name: "IT" },
  { id: "d-hr", department_id: "HR", department_name: "HR" },
];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    role: { findMany: vi.fn(async () => roles) },
    user: { findMany: vi.fn(async () => users) },
    department: { findMany: vi.fn(async () => departments) },
  },
}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }));

import {
  canEditProject,
  canEditTask,
  filterByDepartment,
  getRolePermissions,
  type SessionContext,
} from "@/lib/permissions";

const ctx = (id: string, role: string): SessionContext => {
  const u = users.find((x) => x.id === id)!;
  return { id, token: "", email: u.email, department: u.department_id, division: "", role_system: role, isAdmin: role === "admin" };
};

const admin = ctx("u-admin", "admin");
const mgrIT = ctx("u-mgr-it", "manager");
const memIT = ctx("u-mem-it", "member");
const memHR = ctx("u-mem-hr", "member");

const projectIT = { id: "p1", manager_id: "u-mgr-it", department: "IT" };
const taskOfMemIT = { id: "t1", assignee_id: "u-mem-it", assignee_email: "" };
const taskOfHR = { id: "t2", assignee_id: "u-mem-hr", assignee_email: "" };

beforeEach(() => vi.clearAllMocks());

describe("getRolePermissions", () => {
  it("reads scopes from the Role table", async () => {
    expect((await getRolePermissions(mgrIT)).taskEditScope).toBe("DEPT");
  });

  it("unknown role gets no permissions", async () => {
    const p = await getRolePermissions({ ...memIT, role_system: "intern", isAdmin: false });
    expect(p).toEqual({ viewScope: "NONE", projectEditScope: "NONE", taskEditScope: "NONE", userManageScope: "NONE" });
  });
});

describe("canEditTask", () => {
  it("admin can edit any task", async () => {
    expect(await canEditTask(admin, taskOfHR, null)).toBe(true);
  });

  it("member can edit a task assigned to them", async () => {
    expect(await canEditTask(memIT, taskOfMemIT, projectIT)).toBe(true);
  });

  it("member cannot edit a task of another department", async () => {
    expect(await canEditTask(memIT, taskOfHR, null)).toBe(false);
  });

  it("member cannot edit a colleague's task in the same department (OWNED scope)", async () => {
    const colleagueTask = { id: "t3", assignee_id: "u-mgr-it", assignee_email: "" };
    expect(await canEditTask(memIT, colleagueTask, null)).toBe(false);
  });

  it("DEPT manager can edit tasks assigned within their department", async () => {
    expect(await canEditTask(mgrIT, taskOfMemIT, null)).toBe(true);
  });

  it("DEPT manager cannot edit tasks of another department", async () => {
    expect(await canEditTask(mgrIT, taskOfHR, null)).toBe(false);
  });

  it("project manager can edit tasks in their project", async () => {
    expect(await canEditTask(mgrIT, taskOfHR, projectIT)).toBe(true);
  });
});

describe("canEditProject", () => {
  it("manager of the project can edit it", async () => {
    expect(await canEditProject(mgrIT, projectIT)).toBe(true);
  });

  it("member (OWNED) cannot edit a project they do not manage", async () => {
    expect(await canEditProject(memIT, projectIT)).toBe(false);
  });

  it("member of another department cannot edit", async () => {
    expect(await canEditProject(memHR, projectIT)).toBe(false);
  });
});

describe("filterByDepartment", () => {
  const tasks = [taskOfMemIT, taskOfHR];

  it("admin sees everything", async () => {
    expect(await filterByDepartment(admin, tasks, (t) => t.assignee_id)).toHaveLength(2);
  });

  it("DEPT manager sees only their department", async () => {
    const seen = await filterByDepartment(mgrIT, tasks, (t) => t.assignee_id);
    expect(seen.map((t) => t.id)).toEqual(["t1"]);
  });

  it("OWNED member sees only their own tasks", async () => {
    const seen = await filterByDepartment(memHR, tasks, (t) => t.assignee_id);
    expect(seen.map((t) => t.id)).toEqual(["t2"]);
  });
});
