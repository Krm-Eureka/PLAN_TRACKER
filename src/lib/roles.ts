/**
 * ชื่อ role ที่ถือว่าเป็นผู้ดูแลระบบ (เทียบแบบตรงตัว ไม่สนตัวพิมพ์/ช่องว่าง/ขีด)
 * อย่าใช้ .includes("admin") เพราะ role อย่าง "Dept Admin Viewer" จะได้สิทธิ์ admin ไปด้วย
 * ใช้ได้ทั้งฝั่ง server และ client
 */
const ADMIN_ROLES = new Set(["admin", "superadmin"]);

export function normalizeRole(role?: string | null): string {
  return String(role ?? "").toLowerCase().replace(/[\s_-]+/g, "");
}

export function isAdminRole(role?: string | null): boolean {
  return ADMIN_ROLES.has(normalizeRole(role));
}
