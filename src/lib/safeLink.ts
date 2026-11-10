/**
 * ลิงก์ภายในแอปเท่านั้น: ต้องขึ้นต้นด้วย "/" ตัวเดียว (กัน "//evil.com", "/\evil.com", "javascript:")
 * ใช้ได้ทั้ง server และ client
 */
export function isInternalPath(link: unknown): link is string {
  if (typeof link !== "string" || link.length === 0 || link.length > 2000) return false;
  if (!link.startsWith("/")) return false;
  if (link.startsWith("//") || link.startsWith("/\\")) return false;
  if (/[\u0000-\u001f\s]/.test(link)) return false;
  return true;
}

/** endpoint ของ notification action ต้องเป็น API ภายในแอปเท่านั้น */
export function isInternalApiPath(url: unknown): url is string {
  return isInternalPath(url) && url.startsWith("/api/") && !url.includes("..");
}

export const SAFE_ACTION_METHODS = ["GET", "POST", "PUT", "PATCH"] as const;
