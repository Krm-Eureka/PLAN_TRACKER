import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockTaskUpdate,
  mockUpdateProjectAndParentTasks,
  mockLogActivity,
  mockTask,
  mockProject,
} = vi.hoisted(() => ({
  mockTaskUpdate: vi.fn(async () => ({})),
  mockUpdateProjectAndParentTasks: vi.fn(async () => {}),
  mockLogActivity: vi.fn(async () => {}),
  mockTask: {
    id: "task-1",
    project_id: "proj-1",
    task_name: "Test Task",
    status: "To Do",
    start_date: "2026-11-20",
    due_date: "2026-12-01",
    percent_complete: "0",
    assignee_id: "u-1",
  },
  mockProject: {
    id: "proj-1",
    project_code: "26IN001",
    project_name: "IT Plan",
    progress: "100",
    status: "Done",
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findUnique: vi.fn(async () => mockTask),
      update: mockTaskUpdate,
    },
    project: {
      findFirst: vi.fn(async () => mockProject),
      findUnique: vi.fn(async () => ({ progress: "100", status: "Done" })),
    },
  },
}));

vi.mock("@/lib/permissions", () => ({
  canEditTask: vi.fn(async (ctx: any) => ctx.id === "u-1" || ctx.isAdmin),
}));

vi.mock("@/lib/taskUpdater", () => ({
  updateProjectAndParentTasks: mockUpdateProjectAndParentTasks,
}));

vi.mock("@/lib/logger", () => ({
  logActivity: mockLogActivity,
}));

import { updateTaskStatusCore } from "../taskStatusService";
import type { SessionContext } from "@/lib/permissions";

const ownerCtx: SessionContext = {
  id: "u-1",
  token: "",
  email: "u1@eurekaautomation.co.th",
  name_en: "User One",
  name_th: "ผู้ใช้ 1",
  department: "IT",
  division: "IT",
  role_system: "member",
  isAdmin: false,
};

describe("updateTaskStatusCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes status, sets 100% on Done, rolls up project/parent, and logs activity", async () => {
    const res = await updateTaskStatusCore({
      ctx: ownerCtx,
      taskId: "task-1",
      newStatus: "completed",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.newStatus).toBe("Done");
      expect(res.newPercent).toBe("100");
      expect(res.projectProgress).toBe("100");
      expect(res.projectStatus).toBe("Done");
    }
    expect(mockTaskUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateProjectAndParentTasks).toHaveBeenCalledWith("proj-1");
    expect(mockLogActivity).toHaveBeenCalledTimes(1);
  });

  it("rejects unauthorized user with 403", async () => {
    const res = await updateTaskStatusCore({
      ctx: { ...ownerCtx, id: "u-other" },
      taskId: "task-1",
      newStatus: "Done",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
    expect(mockTaskUpdate).not.toHaveBeenCalled();
  });

  it("rejects unknown status with 400", async () => {
    const res = await updateTaskStatusCore({
      ctx: ownerCtx,
      taskId: "task-1",
      newStatus: "not-a-status",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });
});
