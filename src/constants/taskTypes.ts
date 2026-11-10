/**
 * ประเภทงานของทีม IT — เก็บใน Task.custom_data.task_type (ไม่ต้องเปลี่ยน schema)
 * code สั้น 2 ตัวอักษรใช้บนการ์ดในบอร์ด, สีใช้คลาส Tailwind ที่กำหนดตายตัว
 */
export const TASK_TYPES = [
  { key: "dev", code: "DV", label: "พัฒนาระบบ", chip: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
  { key: "config", code: "CF", label: "ตั้งค่า/Config", chip: "bg-cyan-50 text-cyan-700 border-cyan-200", dot: "bg-cyan-500" },
  { key: "install", code: "IN", label: "ติดตั้งหน้างาน", chip: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  { key: "test", code: "TS", label: "ทดสอบ", chip: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200", dot: "bg-fuchsia-500" },
  { key: "support", code: "SP", label: "ซัพพอร์ต/แก้ปัญหา", chip: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  { key: "doc", code: "DC", label: "เอกสาร/อบรม", chip: "bg-lime-50 text-lime-700 border-lime-200", dot: "bg-lime-600" },
  { key: "meeting", code: "MT", label: "ประชุม", chip: "bg-teal-50 text-teal-700 border-teal-200", dot: "bg-teal-500" },
  { key: "other", code: "OT", label: "อื่น ๆ", chip: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
] as const;

export type TaskTypeKey = (typeof TASK_TYPES)[number]["key"];

const TYPE_KEYS = new Set<string>(TASK_TYPES.map((t) => t.key));

export function isTaskTypeKey(v: unknown): v is TaskTypeKey {
  return typeof v === "string" && TYPE_KEYS.has(v);
}

export function getTaskType(key: unknown) {
  return TASK_TYPES.find((t) => t.key === key) ?? null;
}

/** อ่านประเภทงานจาก custom_data (Json) แบบปลอดภัย */
export function taskTypeOf(customData: unknown): TaskTypeKey | null {
  if (!customData || typeof customData !== "object") return null;
  const v = (customData as Record<string, unknown>).task_type;
  return isTaskTypeKey(v) ? v : null;
}

/**
 * ทำความสะอาด custom_data ที่รับจาก client: เก็บ task_type เฉพาะค่าที่รู้จัก
 * ส่วน key อื่น (custom columns ของโปรเจกต์) คงไว้ตามเดิม
 */
export function sanitizeCustomData(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, unknown> = { ...(input as Record<string, unknown>) };
  if ("task_type" in out && !isTaskTypeKey(out.task_type)) delete out.task_type;
  return out;
}
