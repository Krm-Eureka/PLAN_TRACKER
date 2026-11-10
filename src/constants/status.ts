export const STATUS = {
  DONE: ['done', 'complete', 'completed'],
  IN_PROGRESS: ['progress', 'doing'],
  REVIEW: ['review'],
  HOLD: ['hold', 'wait', 'onhold', 'on_hold', 'on-hold'],
  CANCEL: ['cancel', 'cancelled', 'canceled'],
  TODO: ['to do', 'todo']
} as const;

export const matchesStatus = (status: string | undefined | null, keys: readonly string[]): boolean => {
  if (!status) return false;
  const s = status.toLowerCase();
  return keys.some(k => s.includes(k));
};

export const isDoneStatus = (s?: string | null) => matchesStatus(s, STATUS.DONE);
export const isProgressStatus = (s?: string | null) => matchesStatus(s, STATUS.IN_PROGRESS);
export const isCancelStatus = (s?: string | null) => matchesStatus(s, STATUS.CANCEL);
export const isHoldStatus = (s?: string | null) => matchesStatus(s, STATUS.HOLD);
export const isReviewStatus = (s?: string | null) => matchesStatus(s, STATUS.REVIEW);
export const isTodoStatus = (s?: string | null) => matchesStatus(s, STATUS.TODO);

/**
 * แปลงค่าสถานะ task ที่รับเข้ามาให้เป็นค่ามาตรฐานชุดเดียว (ตรงกับ dropdown ในหน้าโปรเจกต์)
 * คืน null ถ้าไม่รู้จัก
 */
export function normalizeTaskStatus(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (isDoneStatus(s)) return "Done";
  if (isCancelStatus(s)) return "Cancel";
  if (isHoldStatus(s)) return "On Hold";
  if (isReviewStatus(s)) return "Review";
  if (isProgressStatus(s)) return "In Progress";
  if (isTodoStatus(s)) return "To Do";
  return null;
}
