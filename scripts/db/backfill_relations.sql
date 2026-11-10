-- Phase 2 backfill: แปลงสตริงคั่น comma เป็นแถวในตารางความสัมพันธ์
-- รันซ้ำได้ (ON CONFLICT DO NOTHING) และไม่แก้/ลบคอลัมน์เดิม
-- ต้องรัน migration 1_relations_expand ก่อน
-- รันบน DB preview ที่ restore จาก production ก่อนเสมอ แล้วดูผล verify_relations.sql

BEGIN;

-- 1) Task.assignee_id → TaskAssignee  (ค่าในสตริงเป็นได้ทั้ง user id และ email)
INSERT INTO "TaskAssignee" (task_id, user_id)
SELECT DISTINCT t.id, u.id
FROM "Task" t
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(t.assignee_id, ''), ',')) AS a(raw)
JOIN "User" u
  ON u.id = trim(a.raw)
  OR lower(u.email) = lower(trim(a.raw))
WHERE trim(a.raw) <> ''
ON CONFLICT DO NOTHING;

-- 2) Project.department → ProjectDepartment
--    (ค่าในสตริงเป็นได้ทั้ง Department.department_id, Department.id, department_name หรือ name)
INSERT INTO "ProjectDepartment" (project_id, department_id)
SELECT DISTINCT p.id, d.department_id
FROM "Project" p
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(p.department, ''), ',')) AS a(raw)
JOIN "Department" d
  ON lower(d.department_id) = lower(trim(a.raw))
  OR lower(d.id) = lower(trim(a.raw))
  OR lower(COALESCE(d.department_name, '')) = lower(trim(a.raw))
  OR lower(d.name) = lower(trim(a.raw))
WHERE trim(a.raw) <> ''
ON CONFLICT DO NOTHING;

-- 3) Plan.companions → PlanMember  (เจ้าของ Plan เป็นสมาชิกด้วย)
INSERT INTO "PlanMember" (plan_id, user_id)
SELECT DISTINCT pl.id, u.id
FROM "Plan" pl
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(pl.companions, ''), ',')) AS a(raw)
JOIN "User" u ON u.id = trim(a.raw) OR lower(u.email) = lower(trim(a.raw))
WHERE trim(a.raw) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO "PlanMember" (plan_id, user_id)
SELECT pl.id, pl.user_id FROM "Plan" pl WHERE pl.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
