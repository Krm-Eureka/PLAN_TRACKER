import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData } from "@/lib/googleSheets";

export interface SessionContext {
  token: string;
  email: string;
  department: string;
  division: string;
  role_system: string;
  isAdmin: boolean;
}

/**
 * Get the current session with department info.
 * Returns null if unauthenticated.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;
  if (!token) return null;

  return {
    token,
    email: session?.user?.email || "",
    department: (session as any).department || "",
    division: (session as any).division || "",
    role_system: (session as any).role_system || "member",
    isAdmin: (session as any).role_system === "admin",
  };
}

/**
 * Filter tasks by the user's department.
 * Admin sees everything. Others see only tasks where the assignee is in the same dept.
 */
export async function filterByDepartment<T extends Record<string, any>>(
  ctx: SessionContext,
  items: T[],
  getAssigneeEmail: (item: T) => string
): Promise<T[]> {
  if (ctx.isAdmin) return items;

  // Fetch all users to build email → department map
  const users = await fetchSheetData(ctx.token, "Users!A:Z");
  const emailToDept: Record<string, string> = {};
  users.forEach((u: any) => {
    if (u.email) emailToDept[u.email.toLowerCase()] = (u.department || "").toLowerCase();
  });

  const myDept = ctx.department.toLowerCase();

  return items.filter(item => {
    const assigneeEmail = (getAssigneeEmail(item) || "").toLowerCase();
    // Include if assignee's dept matches, OR if no assignee (so creator can see it)
    if (!assigneeEmail) return true;
    return (emailToDept[assigneeEmail] || "") === myDept;
  });
}

/**
 * Filter projects by department.
 * Admin sees all. Others see projects where manager's dept matches theirs.
 */
export async function filterProjectsByDepartment<T extends Record<string, any>>(
  ctx: SessionContext,
  projects: T[]
): Promise<T[]> {
  if (ctx.isAdmin) return projects;

  // If project has dept field use it directly, otherwise use manager email lookup
  const users = await fetchSheetData(ctx.token, "Users!A:Z");
  const emailToDept: Record<string, string> = {};
  users.forEach((u: any) => {
    if (u.email) emailToDept[u.email.toLowerCase()] = (u.department || "").toLowerCase();
  });

  const myDept = ctx.department.toLowerCase();

  return projects.filter(p => {
    // Try project_dept field first (if exists)
    if (p.department) return p.department.toLowerCase() === myDept;
    // Fallback: check manager's department
    const managerDept = emailToDept[(p.manager || "").toLowerCase()] || "";
    return managerDept === myDept || managerDept === "";
  });
}
