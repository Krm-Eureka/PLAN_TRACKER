// ข้อมูลทดสอบสำหรับ DB local/preview เท่านั้น
//
// รัน: ALLOW_SEED=1 SEED_DATABASE_URL="postgres://..." node scripts/db/seed.mjs
//
// ความปลอดภัย:
// - ไม่อ่าน SUPABASE_POSTGRES_PRISMA_URL (ซึ่งชี้ production) ต้องส่ง SEED_DATABASE_URL เองเท่านั้น
// - ต้องตั้ง ALLOW_SEED=1 และห้ามรันเมื่อ NODE_ENV/VERCEL_ENV = production
// - เขียนเฉพาะแถวที่ id ขึ้นต้นด้วย "seed-" แบบ upsert ไม่ลบอะไรเลย
import pg from "pg";

const url = process.env.SEED_DATABASE_URL;
if (process.env.ALLOW_SEED !== "1" || !url) {
  console.error("Refusing to seed: set ALLOW_SEED=1 and SEED_DATABASE_URL to a NON-production database.");
  process.exit(1);
}
if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  console.error("Refusing to seed in a production environment.");
  process.exit(1);
}
if (url === process.env.SUPABASE_POSTGRES_PRISMA_URL || url === process.env.SUPABASE_POSTGRES_URL) {
  console.error("Refusing to seed: SEED_DATABASE_URL is the same as the app's database URL.");
  process.exit(1);
}

const roles = [
  ["seed-role-admin", "admin", "GLOBAL", "GLOBAL", "GLOBAL", "GLOBAL"],
  ["seed-role-manager", "manager", "DEPT", "DEPT", "DEPT", "NONE"],
  ["seed-role-member", "member", "OWNED", "OWNED", "OWNED", "NONE"],
];
const departments = [
  ["seed-dept-it", "SEED-IT", "IT", "IT"],
  ["seed-dept-hr", "SEED-HR", "HR", "HR"],
  ["seed-dept-fin", "SEED-FIN", "Finance", "Finance"],
];
// id, emp_id, name_en, email, role, department_id
const users = [
  ["seed-u-admin", "S001", "Seed Admin", "seed.admin@example.test", "admin", "SEED-IT"],
  ["seed-u-mgr-it", "S002", "Seed IT Manager", "seed.mgr.it@example.test", "manager", "SEED-IT"],
  ["seed-u-mem-it", "S003", "Seed IT Member", "seed.mem.it@example.test", "member", "SEED-IT"],
  ["seed-u-mgr-hr", "S004", "Seed HR Manager", "seed.mgr.hr@example.test", "manager", "SEED-HR"],
  ["seed-u-mem-hr", "S005", "Seed HR Member", "seed.mem.hr@example.test", "member", "SEED-HR"],
];
// id, code, name, manager, departments
const projects = [
  ["seed-p-it", "SEED-IT-01", "Seed IT Project", "seed-u-mgr-it", ["SEED-IT"]],
  ["seed-p-hr", "SEED-HR-01", "Seed HR Project", "seed-u-mgr-hr", ["SEED-HR"]],
  ["seed-p-shared", "SEED-X-01", "Seed Cross-dept Project", "seed-u-mgr-it", ["SEED-IT", "SEED-HR"]],
];
// id, project, name, assignees
const tasks = [
  ["seed-t-it-1", "seed-p-it", "IT task for member", ["seed-u-mem-it"]],
  ["seed-t-it-2", "seed-p-it", "IT task for manager", ["seed-u-mgr-it"]],
  ["seed-t-hr-1", "seed-p-hr", "HR task for member", ["seed-u-mem-hr"]],
  ["seed-t-x-1", "seed-p-shared", "Shared task, two depts", ["seed-u-mem-it", "seed-u-mem-hr"]],
];

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("BEGIN");
  for (const [id, name, view, proj, task, userm] of roles) {
    await client.query(
      `INSERT INTO "Role"(id, role_name, view_scope, project_edit_scope, task_edit_scope, user_manage_scope, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (role_name) DO NOTHING`,
      [id, name, view, proj, task, userm]
    );
  }
  for (const [id, deptId, name, deptName] of departments) {
    await client.query(
      `INSERT INTO "Department"(id, department_id, name, department_name, updated_at)
       VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, department_name = EXCLUDED.department_name, updated_at = now()`,
      [id, deptId, name, deptName]
    );
  }
  for (const [id, empId, nameEn, email, role, dept] of users) {
    await client.query(
      `INSERT INTO "User"(id, emp_id, name_th, name_en, email, role_system, department_id, updated_at)
       VALUES ($1,$2,$3,$3,$4,$5,$6,now())
       ON CONFLICT (id) DO UPDATE SET role_system = EXCLUDED.role_system, department_id = EXCLUDED.department_id, updated_at = now()`,
      [id, empId, nameEn, email, role, dept]
    );
  }
  for (const [id, code, name, manager, depts] of projects) {
    await client.query(
      `INSERT INTO "Project"(id, project_code, project_name, manager_id, status, department, updated_at)
       VALUES ($1,$2,$3,$4,'In Progress',$5,now())
       ON CONFLICT (id) DO UPDATE SET manager_id = EXCLUDED.manager_id, department = EXCLUDED.department, updated_at = now()`,
      [id, code, name, manager, depts.join(", ")]
    );
    for (const d of depts) {
      await client.query(
        `INSERT INTO "ProjectDepartment"(project_id, department_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [id, d]
      );
    }
  }
  for (const [id, project, name, assignees] of tasks) {
    await client.query(
      `INSERT INTO "Task"(id, project_id, task_name, assignee_id, status, updated_at)
       VALUES ($1,$2,$3,$4,'To Do',now())
       ON CONFLICT (id) DO UPDATE SET assignee_id = EXCLUDED.assignee_id, updated_at = now()`,
      [id, project, name, assignees.join(", ")]
    );
    for (const u of assignees) {
      await client.query(
        `INSERT INTO "TaskAssignee"(task_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [id, u]
      );
    }
  }
  await client.query("COMMIT");
  console.log(`Seeded ${roles.length} roles, ${departments.length} departments, ${users.length} users, ${projects.length} projects, ${tasks.length} tasks.`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Seed failed, rolled back:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
