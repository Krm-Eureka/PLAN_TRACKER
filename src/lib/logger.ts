import { prisma } from "@/lib/prisma";
import { v7 as uuidv7 } from "uuid";

export interface ActivityLog {
  action: string;
  project_id: string;
  project_name: string;
  user_name: string;
  user_email: string;
}

/**
 * Logs an activity to the Prisma Log table.
 */
export async function logActivity(_token: string, log: ActivityLog) {
  try {
    await prisma.log.create({
      data: {
        id: uuidv7(),
        action: log.action,
        project_id: log.project_id,
        project_name: log.project_name,
        user_name: log.user_name,
        user_email: log.user_email,
      }
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}
