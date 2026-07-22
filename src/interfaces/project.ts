export interface ProjectData {
  id?: string;
  project_code: string;
  project_name: string;
  client_name?: string;
  manager_id?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  priority?: string;
  department?: string; // Comma-separated list of departments (e.g., "IT,HR")
  color?: string;
  project_email_update?: string;
  created_at?: Date | string;
  updated_at?: Date | string;
  [key: string]: unknown;
}
