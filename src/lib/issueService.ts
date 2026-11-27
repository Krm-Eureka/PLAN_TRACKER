import crypto from "crypto";
import { v7 as uuidv7 } from "uuid";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/logger";
import {
  filterProjectsByDepartment,
  type SessionContext,
} from "@/lib/permissions";

export const ISSUE_STATUSES = [
  "Open",
  "In Progress",
  "Resolved",
  "Closed",
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export function normalizeIssueStatus(input: string): IssueStatus | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (s === "open" || s === "new") return "Open";
  if (s === "in progress" || s === "in_progress" || s === "progress" || s === "doing") {
    return "In Progress";
  }
  if (s === "resolved" || s === "done" || s === "fixed") return "Resolved";
  if (s === "closed" || s === "close") return "Closed";
  return null;
}

function generateIssueCode(): string {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `ISS-${yy}${mm}${dd}-${suffix}`;
}

export type CreateIssueResult =
  | {
      ok: true;
      deduplicated: boolean;
      issue: {
        id: string;
        issue_code: string;
        project_id: string;
        project_code: string;
        project_name: string;
        reporter_name: string;
        description: string;
        status: string;
        source: string;
        created_at: Date;
      };
    }
  | {
      ok: false;
      status: 400 | 403 | 404;
      message: string;
    };

/**
 * Logs a project issue separately from Tasks so Master Plan dates and task
 * progress remain untouched.
 */
export async function createProjectIssue(params: {
  ctx: SessionContext;
  projectIdOrCode: string;
  description: string;
  source: "LINE" | "WEB";
  lineMessageId?: string;
}): Promise<CreateIssueResult> {
  const cleanDescription = params.description.trim();
  if (!cleanDescription) {
    return { ok: false, status: 400, message: "Issue description is required" };
  }

  if (params.lineMessageId) {
    const existing = await prisma.projectIssue.findUnique({
      where: { line_message_id: params.lineMessageId },
      include: { project: true },
    });
    if (existing) {
      return {
        ok: true,
        deduplicated: true,
        issue: {
          id: existing.id,
          issue_code: existing.issue_code,
          project_id: existing.project_id,
          project_code: existing.project.project_code,
          project_name: existing.project.project_name,
          reporter_name: existing.reporter_name,
          description: existing.description,
          status: existing.status,
          source: existing.source,
          created_at: existing.created_at,
        },
      };
    }
  }

  const key = params.projectIdOrCode.trim();
  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { id: key },
        { project_code: { equals: key, mode: "insensitive" } },
      ],
    },
  });

  if (!project) {
    return { ok: false, status: 404, message: `Project '${key}' not found` };
  }

  const visible = await filterProjectsByDepartment(params.ctx, [
    project as unknown as Record<string, unknown>,
  ]);
  if (visible.length === 0) {
    return {
      ok: false,
      status: 403,
      message: "Forbidden: You do not have access to this project.",
    };
  }

  const reporterName =
    params.ctx.name_th || params.ctx.name_en || params.ctx.email;

  const created = await prisma.projectIssue.create({
    data: {
      id: uuidv7(),
      issue_code: generateIssueCode(),
      project_id: project.id,
      reported_by_id: params.ctx.id || null,
      reporter_name: reporterName,
      description: cleanDescription,
      status: "Open",
      source: params.source,
      line_message_id: params.lineMessageId || null,
    },
  });

  await logActivity(params.ctx.token, {
    action: `CREATE ISSUE (${params.source})`,
    project_id: project.id,
    project_name: `${project.project_code} · ${created.issue_code}`,
    user_name: reporterName,
    user_email: params.ctx.email,
  });

  return {
    ok: true,
    deduplicated: false,
    issue: {
      id: created.id,
      issue_code: created.issue_code,
      project_id: project.id,
      project_code: project.project_code,
      project_name: project.project_name,
      reporter_name: created.reporter_name,
      description: created.description,
      status: created.status,
      source: created.source,
      created_at: created.created_at,
    },
  };
}

export type UpdateIssueStatusResult =
  | {
      ok: true;
      issue: {
        id: string;
        issue_code: string;
        project_id: string;
        project_code: string;
        project_name: string;
        status: string;
        resolved_at: Date | null;
      };
    }
  | {
      ok: false;
      status: 400 | 403 | 404;
      message: string;
    };

export async function updateProjectIssueStatus(params: {
  ctx: SessionContext;
  issueIdOrCode: string;
  newStatus: string;
}): Promise<UpdateIssueStatusResult> {
  const normalized = normalizeIssueStatus(params.newStatus);
  if (!normalized) {
    return { ok: false, status: 400, message: "Invalid issue status" };
  }

  const key = params.issueIdOrCode.trim();
  const found = await prisma.projectIssue.findFirst({
    where: {
      OR: [{ id: key }, { issue_code: { equals: key, mode: "insensitive" } }],
    },
    include: { project: true },
  });

  if (!found) {
    return { ok: false, status: 404, message: "Issue not found" };
  }

  const visible = await filterProjectsByDepartment(params.ctx, [
    found.project as unknown as Record<string, unknown>,
  ]);
  if (visible.length === 0) {
    return {
      ok: false,
      status: 403,
      message: "Forbidden: You do not have access to this project's issues.",
    };
  }

  const isResolved = normalized === "Resolved" || normalized === "Closed";
  const updated = await prisma.projectIssue.update({
    where: { id: found.id },
    data: {
      status: normalized,
      resolved_at: isResolved ? found.resolved_at ?? new Date() : null,
    },
  });

  await logActivity(params.ctx.token, {
    action: "UPDATE ISSUE STATUS",
    project_id: found.project_id,
    project_name: `${found.issue_code} -> ${normalized}`,
    user_name: params.ctx.name_en || params.ctx.name_th || params.ctx.email,
    user_email: params.ctx.email,
  });

  return {
    ok: true,
    issue: {
      id: updated.id,
      issue_code: updated.issue_code,
      project_id: found.project_id,
      project_code: found.project.project_code,
      project_name: found.project.project_name,
      status: updated.status,
      resolved_at: updated.resolved_at,
    },
  };
}
