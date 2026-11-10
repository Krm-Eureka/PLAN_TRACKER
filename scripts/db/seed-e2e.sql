-- ข้อมูลสำหรับ E2E ใน CI เท่านั้น (Postgres ชั่วคราวใน GitHub Actions)
-- id ตรงกับข้อมูล mock ใน src/lib/prisma.ts และ src/services/serverApi.ts (IS_TEST_MODE)
-- เพื่อให้ PUT /api/tasks/:id หาแถวเจอ

INSERT INTO "Role"(id, role_name, view_scope, project_edit_scope, task_edit_scope, user_manage_scope, updated_at) VALUES
  ('e2e-role-admin',   'admin',   'GLOBAL', 'GLOBAL', 'GLOBAL', 'GLOBAL', now()),
  ('e2e-role-member',  'member',  'OWNED',  'OWNED',  'OWNED',  'NONE',   now())
ON CONFLICT DO NOTHING;

INSERT INTO "Department"(id, department_id, name, department_name, updated_at) VALUES
  ('e2e-dept-1', 'dept-1', 'IT', 'IT', now())
ON CONFLICT DO NOTHING;

INSERT INTO "User"(id, emp_id, name_th, name_en, email, role_system, department_id, updated_at) VALUES
  ('test-admin-id', 'E2E-1', 'เทส แอดมิน', 'Test Admin', 'admin@test.com', 'Super Admin', 'dept-1', now())
ON CONFLICT DO NOTHING;

INSERT INTO "Project"(id, project_code, project_name, status, department, manager_id, updated_at) VALUES
  ('min-proj-1',  'MP-01', 'Minimal Project A',      'In Progress', 'dept-1', 'test-admin-id', now()),
  ('proj-min-99', 'MP-99', 'Super Minimal Project',  'In Progress', 'dept-1', 'test-admin-id', now())
ON CONFLICT DO NOTHING;

INSERT INTO "Task"(id, project_id, task_name, status, assignee_id, updated_at) VALUES
  ('min-task-1',  'min-proj-1',  'Minimal Task 1',             'Pending',     'test-admin-id', now()),
  ('task-min-88', 'proj-min-99', 'Very Minimal Task Display',  'In Progress', 'test-admin-id', now())
ON CONFLICT DO NOTHING;
