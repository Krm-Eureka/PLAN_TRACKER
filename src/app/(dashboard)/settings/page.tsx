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

const PERMISSION_ROWS: { key: "viewScope" | "projectEditScope" | "taskEditScope" | "userManageScope"; label: string }[] = [
  { key: "viewScope", label: "ดูโปรเจกต์และ task" },
  { key: "projectEditScope", label: "แก้ไข/เลื่อนแผนโปรเจกต์" },
  { key: "taskEditScope", label: "แก้ไข task" },
  { key: "userManageScope", label: "จัดการผู้ใช้" },
];

function toScope(v: string | null | undefined): RbacScope {
  const s = String(v || "NONE").toUpperCase();
  return (["GLOBAL", "DEPT", "OWNED", "NONE"] as const).includes(s as RbacScope) ? (s as RbacScope) : "NONE";
}

function ScopeBadge({ scope }: { scope: RbacScope }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${SCOPE_STYLE[scope]}`}>
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
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 pr-4 font-medium text-right">ผู้ใช้</th>
                  {PERMISSION_ROWS.map((r) => (
                    <th key={r.key} className="py-2 pr-4 font-medium whitespace-nowrap">{r.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td className="py-2 pr-4 font-medium text-slate-800 whitespace-nowrap">{role.role_name}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-slate-600">{usersInRole(role.role_name)}</td>
                    <td className="py-2 pr-4"><ScopeBadge scope={toScope(role.view_scope)} /></td>
                    <td className="py-2 pr-4"><ScopeBadge scope={toScope(role.project_edit_scope)} /></td>
                    <td className="py-2 pr-4"><ScopeBadge scope={toScope(role.task_edit_scope)} /></td>
                    <td className="py-2 pr-4"><ScopeBadge scope={toScope(role.user_manage_scope)} /></td>
                  </tr>
                ))}
                {roles.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-slate-400">ยังไม่มี role ในตาราง Role</td></tr>
                )}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-400">
              อ่านอย่างเดียว — การแก้ไข role ยังต้องทำในฐานข้อมูล (ตาราง Role)
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
