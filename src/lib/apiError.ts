/**
 * ข้อความ error ที่ปลอดภัยสำหรับส่งกลับ client
 * - error จาก Prisma/ฐานข้อมูล: ซ่อนรายละเอียด (อาจเผยชื่อตาราง/คอลัมน์/query) → ใช้ fallback
 * - error อื่นที่โค้ดเรา throw เอง: ส่งข้อความเดิม (UI ใช้แสดงผล)
 * รายละเอียดเต็มยังอยู่ใน console.error ฝั่ง server ตามเดิม
 */
export function safeErrorMessage(error: unknown, fallback = "Internal Server Error"): string {
  if (!error || typeof error !== "object") return fallback;
  const e = error as { name?: string; code?: unknown; message?: unknown; clientVersion?: unknown };

  const isDbError =
    (typeof e.name === "string" && e.name.startsWith("Prisma")) ||
    e.clientVersion !== undefined ||
    (typeof e.code === "string" && /^(P\d{4}|[0-9A-Z]{5}|ECONNREFUSED|ETIMEDOUT)$/.test(e.code));

  if (isDbError) return fallback;
  return typeof e.message === "string" && e.message ? e.message : fallback;
}
