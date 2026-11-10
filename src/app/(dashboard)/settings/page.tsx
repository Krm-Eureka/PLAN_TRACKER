import { redirect } from "next/navigation";
import { ShieldCheck, UserCircle2, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionContext, getRolePermissions, type RbacScope } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SCOPE_LABEL: Record<RbacScope, string> = {
  GLOBAL: "ทั้งองค์กร",
  DEPT: "เฉพาะแผนก",
  OWNED: "เฉพาะของตัวเอง",
  NONE: "ไม่มีสิทธิ์",
};

const SCOPE_STYLE: Record<RbacScope, string> = {
  GLOBAL: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DEPT: "bg-sky-50 text-sky-700 border-sky-200",
  OWNED: "bg-amber-50 text-amber-700 border-amber-200",
  NONE: "bg-slate-50 text-slate-500 border-slate-200",
};

type PermissionKey = "viewScope" | "projectEditScope" | "taskEditScope" | "userManageScope";

const PERMISSION_ROWS: { key: PermissionKey; label: string; short: string }[] = [
  { key: "viewScope", label: "ดูโปรเจกต์และ task", short: "ดูงาน" },
  { key: "projectEditScope", label: "แก้ไข/เลื่อนแผนโปรเจกต์", short: "แก้โปรเจกต์" },
  { key: "taskEditScope", label: "แก้ไข task", short: "แก้ task" },
  { key: "userManageScope", label: "จัดการผู้ใช้", short: "จัดการผู้ใช้" },
];

function toScope(v: string | null | undefined): RbacScope {
  const s = String(v || "NONE").toUpperCase();
  return (["GLOBAL", "DEPT", "OWNED", "NONE"] as const).includes(s as RbacScope) ? (s as RbacScope) : "NONE";
}

function roleScopes(role: {
  view_scope: string | null;
  project_edit_scope: string | null;
  task_edit_scope: string | null;
  user_manage_scope: string | null;
}): Record<PermissionKey, RbacScope> {
  return {
    viewScope: toScope(role.view_scope),
    projectEditScope: toScope(role.project_edit_scope),
    taskEditScope: toScope(role.task_edit_scope),
    userManageScope: toScope(role.user_manage_scope),
  };
}

function ScopeBadge({ scope }: { scope: RbacScope }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${SCOPE_STYLE[scope]}`}>
      {SCOPE_LABEL[scope]}
    </span>
  );
}

export default async function SettingsPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/auth/signin");

  const perms = await getRolePermissions(ctx);
  const canSeeRoles = perms.userManageScope === "GLOBAL";

  const [me, departments, roles, roleCounts] = await Promise.all([
    prisma.user.findUnique({ where: { email: ctx.email.toLowerCase() } }),
    prisma.department.findMany({ select: { department_id: true, department_name: true, name: true } }),
    canSeeRoles ? prisma.role.findMany({ orderBy: { role_name: "asc" } }) : Promise.resolve([]),
    canSeeRoles
      ? prisma.user.groupBy({ by: ["role_system"], _count: { _all: true } })
      : Promise.resolve([] as { role_system: string | null; _count: { _all: number } }[]),
  ]);

  const deptName =
    departments.find((d) => d.department_id === (me?.department_id || ctx.department))?.department_name ||
    me?.department_id ||
    "-";
  const usersInRole = (roleName: string) =>
    roleCounts
      .filter((r) => (r.role_system || "").toLowerCase() === roleName.toLowerCase())
      .reduce((n, r) => n + r._count._all, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm">บัญชีของคุณและสิทธิ์การใช้งานในระบบ</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCircle2 className="w-5 h-5 text-emerald-600" /> บัญชีของฉัน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
              <dt className="text-slate-500">ชื่อ</dt>
              <dd className="font-medium text-slate-800">{me?.name_th || ctx.name_th || "-"} {me?.name_en ? <span className="text-slate-500 font-normal">({me.name_en})</span> : null}</dd>
              <dt className="text-slate-500">อีเมล</dt>
              <dd className="text-slate-800 break-all">{ctx.email}</dd>
              <dt className="text-slate-500">ตำแหน่ง</dt>
              <dd className="text-slate-800">{me?.position || "-"}</dd>
              <dt className="text-slate-500">แผนก</dt>
              <dd className="text-slate-800">{deptName}</dd>
              <dt className="text-slate-500">Role</dt>
              <dd className="text-slate-800">{ctx.role_system || "member"}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> สิทธิ์ของฉัน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100 text-sm">
              {PERMISSION_ROWS.map((row) => (
                <li key={row.key} className="flex items-center justify-between py-2">
                  <span className="text-slate-700">{row.label}</span>
                  <ScopeBadge scope={perms[row.key]} />
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-400">
              ถ้าสิทธิ์ไม่ถูกต้อง ติดต่อผู้ดูแลระบบ การเปลี่ยน role มีผลภายใน 5 นาที
            </p>
          </CardContent>
        </Card>
      </div>

      {canSeeRoles && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-5 h-5 text-emerald-600" /> Role ทั้งหมดในระบบ
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roles.length === 0 && (
              <p className="py-4 text-center text-sm text-slate-400">ยังไม่มี role ในตาราง Role</p>
            )}

            {/* จอแคบ: การ์ดต่อ role (ไม่ต้องเลื่อนแนวนอน) */}
            <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
              {roles.map((role) => {
                const scopes = roleScopes(role);
                return (
                  <li key={role.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800 break-all">{role.role_name}</span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 tabular-nums">
                        {usersInRole(role.role_name)} คน
                      </span>
                    </div>
                    <dl className="space-y-1.5 text-sm">
                      {PERMISSION_ROWS.map((row) => (
                        <div key={row.key} className="flex items-center justify-between gap-3">
                          <dt className="text-slate-500">{row.short}</dt>
                          <dd><ScopeBadge scope={scopes[row.key]} /></dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                );
              })}
            </ul>

            {/* จอกว้าง: ตาราง */}
            {roles.length > 0 && (
              <table className="hidden w-full text-sm lg:table">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">Role</th>
                    <th className="py-2 pr-6 text-right font-medium">ผู้ใช้</th>
                    {PERMISSION_ROWS.map((r) => (
                      <th key={r.key} className="whitespace-nowrap py-2 pr-4 font-medium">{r.short}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roles.map((role) => {
                    const scopes = roleScopes(role);
                    return (
                      <tr key={role.id} className="hover:bg-slate-50/60">
                        <td className="whitespace-nowrap py-2.5 pr-4 font-medium text-slate-800">{role.role_name}</td>
                        <td className="py-2.5 pr-6 text-right tabular-nums text-slate-600">{usersInRole(role.role_name)}</td>
                        {PERMISSION_ROWS.map((r) => (
                          <td key={r.key} className="py-2.5 pr-4"><ScopeBadge scope={scopes[r.key]} /></td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-slate-400">
              อ่านอย่างเดียว — การแก้ไข role ยังต้องทำในฐานข้อมูล (ตาราง Role)
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
