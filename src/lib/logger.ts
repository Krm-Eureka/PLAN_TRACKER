import { appendSheetRow } from "./googleSheets";

export interface ActivityLog {
  timestamp?: string;
  action: string;
  project_id: string;
  project_name: string;
  user_name: string;
  user_email: string;
}

/**
 * Logs an activity to the "Logs" Google Sheet.
 * Expected columns:
 * A: timestamp, B: action, C: project_id, D: project_name, E: user_name, F: user_email
 */
export async function logActivity(token: string, log: ActivityLog) {
  try {
    const timestamp = log.timestamp || new Date().toISOString();
    
    const rowData = [
      timestamp,
      log.action,
      log.project_id,
      log.project_name,
      log.user_name,
      log.user_email
    ];

    await appendSheetRow(token, "Logs!A:F", rowData);
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}
