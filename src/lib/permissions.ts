// @ts-nocheck
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export interface SessionContext {
  id: string;
  token: string;
  email: string;
  name_en?: string;
  name_th?: string;
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
    id: (session as { id?: string }).id || (session?.user as any)?.id || "",
    token,
    email: session?.user?.email || "",
    name_en: (session?.user as any)?.name_en || session?.user?.name || "",
    name_th: (session?.user as any)?.name_th || "",
    department: (session as { department?: string }).department || "",
    division: (session as { division?: string }).division || "",
    role_system: (session as { role_system?: string }).role_system || "member",
    isAdmin: ((session as { role_system?: string }).role_system || "").toLowerCase().includes("admin"),
  };
}

// Short-term in-memory cache to prevent redundant DB roundtrips on permission checks (30s TTL)
let rolesCache: { data: any[]; timestamp: number } | null = null;
let usersLightCache: { data: any[]; timestamp: number } | null = null;
let deptsLightCache: { data: any[]; timestamp: number } | null = null;

const PERM_CACHE_TTL_MS = 30 * 1000;

async function getCachedRoles() {
  const now = Date.now();
  if (rolesCache && (now - rolesCache.timestamp < PERM_CACHE_TTL_MS)) {
    return rolesCache.data;
  }
  try {
    const roles = await prisma.role.findMany();
    rolesCache = { data: roles, timestamp: now };
    return roles;
  } catch (e) {
    console.error("Failed to fetch roles from DB:", e);
    return rolesCache?.data || [];
  }
}

async function getCachedUsersLight() {
  const now = Date.now();
  if (usersLightCache && (now - usersLightCache.timestamp < PERM_CACHE_TTL_MS)) {
    return usersLightCache.data;
  }
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, department_id: true, emp_id: true } });
    usersLightCache = { data: users, timestamp: now };
    return users;
  } catch (e) {
    console.error("Failed to fetch users from DB:", e);
    return usersLightCache?.data || [];
  }
}

async function getCachedDeptsLight() {
  const now = Date.now();
  if (deptsLightCache && (now - deptsLightCache.timestamp < PERM_CACHE_TTL_MS)) {
    return deptsLightCache.data;
  }
  try {
    const depts = await prisma.department.findMany({ select: { id: true, department_id: true, department_name: true } });
    deptsLightCache = { data: depts, timestamp: now };
    return depts;
  } catch (e) {
    console.error("Failed to fetch departments from DB:", e);
    return deptsLightCache?.data || [];
  }
}

export type RbacScope = "GLOBAL" | "DEPT" | "OWNED" | "NONE";

export interface RolePermissions {
  viewScope: RbacScope;
  projectEditScope: RbacScope;
  taskEditScope: RbacScope;
  userManageScope: RbacScope;
}

/**
 * Fetch and evaluate role permissions from the Database
 */
export async function getRolePermissions(ctx: SessionContext): Promise<RolePermissions> {
  const defaultPerms: RolePermissions = {
    viewScope: "NONE",
    projectEditScope: "NONE",
    taskEditScope: "NONE",
    userManageScope: "NONE",
  };

  if (!ctx.role_system) return defaultPerms;

  try {
    const roles = await getCachedRoles();
    const myRole = roles.find((r: any) => String(r.role_name || '').toLowerCase() === String(ctx.role_system).toLowerCase());
    
    if (myRole) {
      return {
        viewScope: (String(myRole.view_scope || "NONE").toUpperCase()) as RbacScope,
        projectEditScope: (String(myRole.project_edit_scope || "NONE").toUpperCase()) as RbacScope,
        taskEditScope: (String(myRole.task_edit_scope || "NONE").toUpperCase()) as RbacScope,
        userManageScope: (String(myRole.user_manage_scope || "NONE").toUpperCase()) as RbacScope,
      };
    }
  } catch (e) {
    console.error("Failed to fetch roles from DB:", e);
  }

  // Fallback if DB fails or role not found
  if (ctx.isAdmin || ctx.role_system.toLowerCase() === "superadmin") {
    return {
      viewScope: "GLOBAL",
      projectEditScope: "GLOBAL",
      taskEditScope: "GLOBAL",
      userManageScope: "GLOBAL",
    };
  }

  return defaultPerms;
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
  const perms = await getRolePermissions(ctx);
  if (perms.viewScope === "GLOBAL") return items;

  // Fetch all users from cache to build email → department map
  const users = await getCachedUsersLight();
  const emailToDept: Record<string, string> = {};
  const idToDept: Record<string, string> = {};
  const idToEmail: Record<string, string> = {};

  let myDept = (ctx.department || "").toLowerCase();

  users.forEach((u: { id: string | null; email: string | null; department_id: string | null }) => {
    const uEmail = (u.email || "").toLowerCase();
    const uDept = (u.department_id || "").toLowerCase();
    if (u.id) {
      idToDept[u.id] = uDept;
      idToEmail[u.id] = uEmail;
    }
    if (uEmail) {
      emailToDept[uEmail] = uDept;
      if (!myDept && uEmail === ctx.email.toLowerCase()) {
        myDept = uDept;
      }
    }
  });

  return items.filter(item => {
    const assigneeEmailsStr = String(getAssigneeEmail(item) || "").toLowerCase();
    if (!assigneeEmailsStr) return true; // Include if no assignee

    const assigneeList = assigneeEmailsStr.split(",").map((e: string) => e.trim()).filter(Boolean);

    // Translate IDs to Emails where necessary (for "OWNED" check)
    const emails = assigneeList.map(item => item.includes("@") ? item : (idToEmail[item] || item));

    // Always include tasks explicitly assigned to me
    if (emails.includes(ctx.email.toLowerCase())) return true;

    if (perms.viewScope === "OWNED") return false;

    // Only those with DEPT viewScope can see tasks of other people in their department
    if (perms.viewScope === "DEPT" && myDept !== "") {
      return assigneeList.some(item => {
        const dept = item.includes("@") ? emailToDept[item] : idToDept[item];
        return (dept || "") === myDept;
      });
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
  const perms = await getRolePermissions(ctx);
  if (perms.viewScope === "GLOBAL") return projects;

  const [users, departments] = await Promise.all([
    getCachedUsersLight(),
    getCachedDeptsLight()
  ]);

  const emailToDept: Record<string, string> = {};
  const idToEmail: Record<string, string> = {};

  let myDept = (ctx.department || "").toLowerCase();

  users.forEach((u: { id: string | null; email: string | null; department_id: string | null }) => {
    const uEmail = (u.email || "").toLowerCase();
    if (u.id) {
      idToEmail[String(u.id).toLowerCase()] = uEmail;
    }
    if (uEmail) {
      emailToDept[uEmail] = (u.department_id || "").toLowerCase();
      if (!myDept && uEmail === ctx.email.toLowerCase()) {
        myDept = (u.department_id || "").toLowerCase();
      }
    }
  });

  // Resolve myDept UUID to department name if possible
  let myDeptName = myDept;
  if (myDept && departments.length > 0) {
    const d = departments.find((dept: any) => dept.id?.toLowerCase() === myDept || dept.department_id?.toLowerCase() === myDept);
    if (d && d.department_name) {
      myDeptName = String(d.department_name).toLowerCase();
    }
  }

  return projects.filter((p: any) => {
    // Support manager, manager_id, manager_email
    let managerEmail = String(p.manager_id || p.manager || p.manager_email || "").toLowerCase();
    
    // Resolve UUID to email if needed
    if (managerEmail && !managerEmail.includes("@")) {
      managerEmail = idToEmail[managerEmail] || managerEmail;
    }

    // Always include if I am the manager
    if (managerEmail && managerEmail === ctx.email.toLowerCase()) return true;

    // Try project_dept field first (if exists), handling multiple departments (comma separated)
    if (p.department) {
      try {
        const depts = String(p.department).split(',').map((d: string) => d.trim().toLowerCase());
        if ((depts.includes(myDept) || depts.includes(myDeptName)) && perms.viewScope === "DEPT") return true;
        // If it doesn't match the department list directly, don't fall back to manager.
        return false;
      } catch {
        return false;
      }
    }

    if (perms.viewScope === "DEPT") {
      // Fallback: check manager's department (only if project has no department specified)
      const managerDept = emailToDept[managerEmail] || "";
      return (myDept !== "" && managerDept === myDept) || managerDept === "";
    }
    
    return false;
  });
}

/**
 * Check if the user has permission to edit a specific project.
 */
export async function canEditProject(ctx: SessionContext, project: any): Promise<boolean> {
  const perms = await getRolePermissions(ctx);
  
  if (perms.projectEditScope === "GLOBAL") return true;
  if (perms.projectEditScope === "NONE") return false;

  const [users, departments] = await Promise.all([
    getCachedUsersLight(),
    getCachedDeptsLight()
  ]);
  const emailToDept: Record<string, string> = {};
  const idToEmail: Record<string, string> = {};
  let myDept = (ctx.department || "").toLowerCase();

  users.forEach((u: { id: string | null; email: string | null; department_id: string | null }) => {
    const uEmail = (u.email || "").toLowerCase();
    if (u.id) {
      idToEmail[String(u.id).toLowerCase()] = uEmail;
    }
    if (uEmail) {
      emailToDept[uEmail] = (u.department_id || "").toLowerCase();
      if (!myDept && uEmail === ctx.email.toLowerCase()) {
        myDept = (u.department_id || "").toLowerCase();
      }
    }
  });

  let myDeptName = myDept;
  if (myDept && departments.length > 0) {
    const d = departments.find((dept: any) => dept.id?.toLowerCase() === myDept || dept.department_id?.toLowerCase() === myDept);
    if (d && d.department_name) {
      myDeptName = String(d.department_name).toLowerCase();
    }
  }

  let managerEmail = String(project.manager_id || project.manager || project.manager_email || "").toLowerCase();
  
  if (managerEmail && !managerEmail.includes("@")) {
    managerEmail = idToEmail[managerEmail] || managerEmail;
  }

  if (managerEmail && managerEmail === ctx.email.toLowerCase()) return true;

  if (perms.projectEditScope === "OWNED") return false;

  if (project.department) {
    try {
      const depts = String(project.department).split(',').map((d: string) => d.trim().toLowerCase());
      if (depts.includes(myDept) || depts.includes(myDeptName)) return true;
    } catch {
      // ignore
    }
  }

  const managerDept = emailToDept[managerEmail] || "";
  if (myDept !== "" && managerDept === myDept) return true;

  return false;
}

/**
 * Check if the user has permission to edit a specific task.
 */
export async function canEditTask(ctx: SessionContext, task: any, project: any): Promise<boolean> {
  const perms = await getRolePermissions(ctx);

  if (perms.taskEditScope === "GLOBAL") return true;
  if (perms.taskEditScope === "NONE") return false;

  const assigneeEmailsStr = String(task.assignee_email || task.assignee_id || "").toLowerCase();
  const assigneeEmails = assigneeEmailsStr.split(",").map((e: string) => e.trim()).filter(Boolean);
  if (assigneeEmails.includes(ctx.email.toLowerCase())) return true;

  if (project) {
    let managerEmail = String(project.manager_id || project.manager || project.manager_email || "").toLowerCase();
    if (managerEmail && !managerEmail.includes("@")) {
      const users = await getCachedUsersLight();
      const user = users.find((u: any) => u.id === managerEmail);
      if (user && user.email) {
        managerEmail = user.email.toLowerCase();
      }
    }
    if (managerEmail && managerEmail === ctx.email.toLowerCase()) return true;
  }

  if (perms.taskEditScope === "OWNED") return false;

  if (perms.taskEditScope === "DEPT") {

    if (project && await canEditProject(ctx, project)) {
      return true;
    }
    
    const users = await getCachedUsersLight();
    const emailToDept: Record<string, string> = {};
    let myDept = (ctx.department || "").toLowerCase();
    
    users.forEach((u: { email: string | null; department_id: string | null }) => {
      const uEmail = (u.email || "").toLowerCase();
      if (uEmail) {
        emailToDept[uEmail] = (u.department_id || "").toLowerCase();
        if (!myDept && uEmail === ctx.email.toLowerCase()) {
          myDept = (u.department_id || "").toLowerCase();
        }
      }
    });

    if (myDept !== "") {
      const canEdit = assigneeEmails.some((email: string) => (emailToDept[email] || "") === myDept);
      if (canEdit) return true;
    }
  }

  return false;
}
