export interface Recipient {
  name: string;
  email: string;
}

const EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/**
 * แยกรายชื่อผู้รับจากข้อความ เช่น
 *   `Sukit J <sukit@x.co.th>, "Doe, John" <john@y.com>; plain@z.com`
 * รองรับชื่อที่มี comma ในเครื่องหมายคำพูด และคั่นด้วย , ; หรือขึ้นบรรทัดใหม่
 * ตัดอีเมลซ้ำ (ไม่สนตัวพิมพ์) โดยเก็บชื่อแรกที่เจอ
 */
export function parseRecipients(input: string): Recipient[] {
  const out: Recipient[] = [];
  const seen = new Set<string>();
  const re = /(?:"([^"]*)"|([^,;<>\n"]*?))\s*<([^>]+)>|([^\s,;<>"]+@[^\s,;<>"]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const email = (m[3] || m[4] || "").trim();
    const name = (m[1] ?? m[2] ?? "").trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: name && name.toLowerCase() !== key ? name : "", email });
  }
  return out;
}

/** แปลงกลับเป็นข้อความสำหรับส่ง (ใส่เครื่องหมายคำพูดถ้าชื่อมีอักขระพิเศษ) */
export function formatRecipient(r: Recipient): string {
  if (!r.name) return r.email;
  const name = /[",;<>@]/.test(r.name) ? `"${r.name.replace(/"/g, "'")}"` : r.name;
  return `${name} <${r.email}>`;
}

export function formatRecipients(list: Recipient[]): string {
  return list.map(formatRecipient).join(", ");
}

/** รวมรายชื่อหลายชุด ตัดอีเมลซ้ำ และตัดอีเมลที่ระบุใน exclude (เช่น อีเมลของผู้ส่งเอง) */
export function mergeRecipients(lists: Recipient[][], exclude: string[] = []): Recipient[] {
  const skip = new Set(exclude.map((e) => e.toLowerCase()).filter(Boolean));
  const out: Recipient[] = [];
  for (const list of lists) {
    for (const r of list) {
      const key = r.email.toLowerCase();
      if (skip.has(key)) continue;
      skip.add(key);
      out.push(r);
    }
  }
  return out;
}
