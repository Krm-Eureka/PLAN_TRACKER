-- Phase 2 verify: อ่านอย่างเดียว ไม่แก้ข้อมูล
-- ทุก query ควรได้ 0 แถว ถ้าได้มากกว่า 0 = ค่าในสตริงเดิมที่จับคู่ไม่ได้ ต้องแก้ข้อมูลหรือตัดสินใจทิ้งก่อนย้าย read

-- 1) assignee ที่จับคู่กับ User ไม่ได้ (เช่น email คนที่ลาออก, พิมพ์ผิด)
SELECT t.id AS task_id, t.task_name, trim(a.raw) AS unmatched_assignee
FROM "Task" t
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(t.assignee_id, ''), ',')) AS a(raw)
WHERE trim(a.raw) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "User" u
    WHERE u.id = trim(a.raw) OR lower(u.email) = lower(trim(a.raw))
  )
ORDER BY t.id;

-- 2) แผนกในโปรเจกต์ที่จับคู่กับ Department ไม่ได้
SELECT p.id AS project_id, p.project_code, trim(a.raw) AS unmatched_department
FROM "Project" p
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(p.department, ''), ',')) AS a(raw)
WHERE trim(a.raw) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "Department" d
    WHERE lower(d.department_id) = lower(trim(a.raw))
       OR lower(d.id) = lower(trim(a.raw))
       OR lower(COALESCE(d.department_name, '')) = lower(trim(a.raw))
       OR lower(d.name) = lower(trim(a.raw))
  )
ORDER BY p.project_code;

-- 3) companions ที่จับคู่กับ User ไม่ได้
SELECT pl.id AS plan_id, trim(a.raw) AS unmatched_companion
FROM "Plan" pl
CROSS JOIN LATERAL unnest(string_to_array(COALESCE(pl.companions, ''), ',')) AS a(raw)
WHERE trim(a.raw) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "User" u WHERE u.id = trim(a.raw) OR lower(u.email) = lower(trim(a.raw))
  );

-- 4) จำนวนเทียบกัน: assignee ที่จับคู่ได้ในสตริงเดิม vs แถวใน TaskAssignee (ต้องเท่ากัน)
SELECT
  (SELECT count(DISTINCT (t.id, u.id))
     FROM "Task" t
     CROSS JOIN LATERAL unnest(string_to_array(COALESCE(t.assignee_id, ''), ',')) AS a(raw)
     JOIN "User" u ON u.id = trim(a.raw) OR lower(u.email) = lower(trim(a.raw))
     WHERE trim(a.raw) <> '') AS legacy_pairs,
  (SELECT count(*) FROM "TaskAssignee") AS new_rows;
