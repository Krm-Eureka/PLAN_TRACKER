export interface TaskData {
  id?: string;
  task_id?: string;       // legacy compatibility
  project_id: string;
  project_code?: string;  // legacy compatibility
  task_name: string;
  description?: string;
  assignee_id?: string;   // Comma-separated list of UUIDs
  assignee_name?: string; // Comma-separated list of human-readable names
  assignee?: string;      // legacy compatibility
  owner_email?: string;   // legacy compatibility
  start_date?: string;    // วันที่วางแผนเริ่มงาน
  due_date?: string;      // วันกำหนดเสร็จ (deadline)
  update_date?: string;   // วันที่อัปเดตสถานะล่าสุด (set อัตโนมัติเมื่อ status เปลี่ยน)
  is_delay?: string;      // "TRUE" / "FALSE" — end_date > due_date
  status: string;
  priority?: string;
  // Gantt hierarchy & interactive fields
  task_order?: string;        // e.g. "1", "1.1", "1.1.1" — ลำดับและระดับงาน
  parent_task_id?: string;    // UUID of parent task for sub-task grouping
  percent_complete?: string;  // 0-100 — ความคืบหน้า (กรอกเองหรือคำนวณจาก status)
  [key: string]: unknown;
}
