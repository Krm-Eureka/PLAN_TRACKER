export interface MentionableUser {
  id: string;
  name_en?: string | null;
  name_th?: string | null;
  emp_id?: string | null;
}

/**
 * หา user ที่ถูก @mention ในข้อความ โดยเทียบ "@ชื่อเต็ม" ตรง ๆ
 * (รองรับชื่อที่มีช่องว่างและชื่อภาษาไทย — regex แบบ @(\w+) เดิมจับได้แค่คำแรกของชื่ออังกฤษ)
 * เทียบชื่อยาวก่อน เพื่อไม่ให้ "@Somchai" ไปตรงกับ "@Somchai Jaidee" ผิดคน
 */
export function findMentionedUserIds(content: string, users: MentionableUser[]): string[] {
  if (!content.includes("@")) return [];
  const lower = content.toLowerCase();

  const candidates = users
    .flatMap((u) =>
      [u.name_en, u.name_th, u.emp_id]
        .filter((n): n is string => !!n && n.trim().length > 0)
        .map((name) => ({ id: u.id, token: `@${name.trim().toLowerCase()}` }))
    )
    .sort((a, b) => b.token.length - a.token.length);

  const found = new Set<string>();
  let remaining = lower;
  for (const c of candidates) {
    let idx = remaining.indexOf(c.token);
    while (idx !== -1) {
      const next = remaining.charAt(idx + c.token.length);
      // ต้องจบคำ: ตัวถัดไปเป็นช่องว่าง/เครื่องหมาย/จบข้อความ (กัน "@Ann" ตรงกับ "@Anna")
      if (next === "" || /[\s.,!?;:)\]]/.test(next)) {
        found.add(c.id);
        // ลบส่วนที่จับแล้ว กันชื่อสั้นจับซ้ำในตำแหน่งเดียวกัน
        remaining = remaining.slice(0, idx) + " ".repeat(c.token.length) + remaining.slice(idx + c.token.length);
      }
      idx = remaining.indexOf(c.token, idx + 1);
    }
  }
  return [...found];
}
