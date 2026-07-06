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
  const token = (session as { accessToken?: string })?.accessToken;
  if (!token) return null;

  return {
    token,
    email: session?.user?.email || "",
    department: (session as { department?: string }).department || "",
    division: (session as { division?: string }).division || "",
    role_system: (session as { role_system?: string }).role_system || "member",
    isAdmin: (session as { role_system?: string }).role_system === "admin",
  };
}

/**
 * Filter tasks by the user's department.
 * Admin sees everything. Others see only tasks where the assignee is in the same dept.
 */
export async function filterByDepartment<T extends Record<string, unknown>>(
  ctx: SessionContext,
  items: T[],
  getAssigneeEmail: (item: T) => string
): Promise<T[]> {
  if (ctx.isAdmin) return items;

  // Fetch all users to build email → department map
  const users = await fetchSheetData(ctx.token, "Users!A:Z");
  const emailToDept: Record<string, string> = {};

  let myDept = (ctx.department || "").toLowerCase();

  users.forEach((u: { email?: string; department?: string }) => {
    const uEmail = (u.email || "").toLowerCase();
    if (uEmail) {
      emailToDept[uEmail] = (u.department || "").toLowerCase();
      // Fallback: if session didn't have department, find it now
      if (!myDept && uEmail === ctx.email.toLowerCase()) {
        myDept = (u.department || "").toLowerCase();
      }
    }
  });

  const isManagerOrHigher = ctx.isAdmin || 
    (ctx.role_system || "").toLowerCase().includes("manager") || 
    (ctx.role_system || "").toLowerCase().includes("md") || 
    (ctx.role_system || "").toLowerCase().includes("director") ||
    (ctx.role_system || "").toLowerCase().includes("supervisor");

  return items.filter(item => {
    const assigneeEmailsStr = String(getAssigneeEmail(item) || "").toLowerCase();
    if (!assigneeEmailsStr) return true; // Include if no assignee

    const assigneeEmails = assigneeEmailsStr.split(",").map(e => e.trim()).filter(Boolean);

    // Always include tasks explicitly assigned to me
    if (assigneeEmails.includes(ctx.email.toLowerCase())) return true;

    // Only managers and higher can see tasks of other people in their department
    if (isManagerOrHigher && myDept !== "") {
      return assigneeEmails.some(email => (emailToDept[email] || "") === myDept);
    }
    
    return false;
  });
}

/**
 * Filter projects by department.
 * Admin sees all. Others see projects where manager's dept matches theirs.
 */
export async function filterProjectsByDepartment<T extends Record<string, unknown>>(
  ctx: SessionContext,
  projects: T[]
): Promise<T[]> {
  if (ctx.isAdmin) return projects;

  // If project has dept field use it directly, otherwise use manager email lookup
  const users = await fetchSheetData(ctx.token, "Users!A:Z");
  const emailToDept: Record<string, string> = {};

  let myDept = (ctx.department || "").toLowerCase();

  users.forEach((u: { email?: string; department?: string }) => {
    const uEmail = (u.email || "").toLowerCase();
    if (uEmail) {
      emailToDept[uEmail] = (u.department || "").toLowerCase();
      if (!myDept && uEmail === ctx.email.toLowerCase()) {
        myDept = (u.department || "").toLowerCase();
      }
    }
  });

  return projects.filter(p => {
    // Support manager, manager_id, manager_email
    const managerEmail = String(p.manager_id || p.manager || p.manager_email || "").toLowerCase();

    // Always include if I am the manager
    if (managerEmail && managerEmail === ctx.email.toLowerCase()) return true;

    // Try project_dept field first (if exists), handling multiple departments (comma separated)
    if (p.department) {
      try {
        const depts = String(p.department).split(',').map((d: string) => d.trim().toLowerCase());
        if (depts.includes(myDept)) return true;
        // If it doesn't match the department list directly, don't fall back to manager.
        return false;
      } catch {
        return false;
      }
    }

    // Fallback: check manager's department (only if project has no department specified)
    const managerDept = emailToDept[managerEmail] || "";
    return (myDept !== "" && managerDept === myDept) || managerDept === "";
  });
}
