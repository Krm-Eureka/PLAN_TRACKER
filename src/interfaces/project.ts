export interface ProjectData {
  project_code: string;
  project_name: string;
  description?: string;
  manager?: string;
  start_date?: string;
  end_date?: string;
  status: string;
  priority?: string;
  [key: string]: any;
}
