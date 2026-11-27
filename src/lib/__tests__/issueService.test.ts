import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockProject,
  mockCreate,
  mockFindIssueUnique,
  mockFindIssueFirst,
  mockUpdateIssue,
} = vi.hoisted(() => ({
  mockProject: {
    id: "proj-1",
    project_code: "26M018",
    project_name: "Assembly Machine",
    manager_id: "u-mgr",
    department: "AS",
  },
  mockCreate: vi.fn(async ({ data }: any) => ({
    ...data,
    created_at: new Date("2026-11-27T04:00:00Z"),
  })),
  mockFindIssueUnique: vi.fn(),
  mockFindIssueFirst: vi.fn(),
  mockUpdateIssue: vi.fn(async ({ where, data }: any) => ({
    id: where.id,
    issue_code: "ISS-261127-0001",
    ...data,
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findFirst: vi.fn(async () => mockProject),
    },
    projectIssue: {
      findUnique: mockFindIssueUnique,
      findFirst: mockFindIssueFirst,
      create: mockCreate,
      update: mockUpdateIssue,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logActivity: vi.fn(async () => {}),
}));

vi.mock("@/lib/permissions", () => ({
  filterProjectsByDepartment: vi.fn(async (ctx: any, projects: any[]) =>
    ctx.department === "AS" || ctx.isAdmin ? projects : []
  ),
}));

import {
  normalizeIssueStatus,
  createProjectIssue,
  updateProjectIssueStatus,
} from "../issueService";
import type { SessionContext } from "@/lib/permissions";

const asUserCtx: SessionContext = {
  id: "u-as-1",
  token: "",
  email: "as1@eurekaautomation.co.th",
  name_en: "AS Staff",
  name_th: "พนักงาน AS",
  department: "AS",
  division: "AS",
  role_system: "member",
  isAdmin: false,
};

const otherDeptCtx: SessionContext = {
  ...asUserCtx,
  id: "u-hr-1",
  email: "hr@eurekaautomation.co.th",
  department: "HR",
};

describe("normalizeIssueStatus", () => {
  it("normalizes aliases and rejects unknown statuses", () => {
    expect(normalizeIssueStatus("open")).toBe("Open");
    expect(normalizeIssueStatus("in_progress")).toBe("In Progress");
    expect(normalizeIssueStatus("done")).toBe("Resolved");
    expect(normalizeIssueStatus("closed")).toBe("Closed");
    expect(normalizeIssueStatus("invalid")).toBeNull();
  });
});

describe("createProjectIssue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindIssueUnique.mockResolvedValue(null);
  });

  it("creates an issue for visible project without altering Master Plan", async () => {
    const res = await createProjectIssue({
      ctx: asUserCtx,
      projectIdOrCode: "26M018",
      description: "มอเตอร์มีเสียงดัง",
      source: "LINE",
      lineMessageId: "line-msg-1",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.deduplicated).toBe(false);
      expect(res.issue.project_code).toBe("26M018");
      expect(res.issue.status).toBe("Open");
      expect(res.issue.source).toBe("LINE");
    }
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("deduplicates repeated LINE webhook deliveries by lineMessageId", async () => {
    mockFindIssueUnique.mockResolvedValueOnce({
      id: "iss-existing",
      issue_code: "ISS-261127-AAAA",
      project_id: "proj-1",
      reporter_name: "พนักงาน AS",
      description: "มอเตอร์มีเสียงดัง",
      status: "Open",
      source: "LINE",
      created_at: new Date("2026-11-27T04:00:00Z"),
      project: mockProject,
    });

    const res = await createProjectIssue({
      ctx: asUserCtx,
      projectIdOrCode: "26M018",
      description: "มอเตอร์มีเสียงดัง",
      source: "LINE",
      lineMessageId: "line-msg-dup",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.deduplicated).toBe(true);
      expect(res.issue.id).toBe("iss-existing");
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("forbids creating issues on projects outside user's department", async () => {
    const res = await createProjectIssue({
      ctx: otherDeptCtx,
      projectIdOrCode: "26M018",
      description: "test",
      source: "LINE",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });
});

describe("updateProjectIssueStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets resolved_at when marked Resolved", async () => {
    mockFindIssueFirst.mockResolvedValueOnce({
      id: "iss-1",
      issue_code: "ISS-261127-0001",
      project_id: "proj-1",
      status: "Open",
      resolved_at: null,
      project: mockProject,
    });

    const res = await updateProjectIssueStatus({
      ctx: asUserCtx,
      issueIdOrCode: "iss-1",
      newStatus: "Resolved",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.issue.status).toBe("Resolved");
      expect(res.issue.resolved_at).toBeInstanceOf(Date);
    }
  });
});
