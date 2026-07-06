export interface TaskData {
  id?: string;
  task_id?: string;       // legacy compatibility
  project_id: string;
  project_code?: string;  // legacy compatibility
  task_name: string;
  description?: string;
  assignee_id?: string;
  assignee_name?: string; // human-readable name (stored in sheet)
  assignee?: string;      // legacy compatibility
  owner_email?: string;   // legacy compatibility
  start_date?: string;    // วันที่วางแผนเริ่มงาน
  due_date?: string;      // วันกำหนดเสร็จ (deadline)
  end_date?: string;      // วันที่ DONE จริง (set อัตโนมัติเมื่อ status = Done)
  is_delay?: string;      // "TRUE" / "FALSE" — end_date > due_date
  status: string;
  priority?: string;
  [key: string]: unknown;
}
