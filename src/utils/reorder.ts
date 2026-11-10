export interface OrderableTask {
  id?: string | null;
  parent_task_id?: string | null;
  task_order?: string | null;
}

export type ReorderResult =
  | { ok: true; updates: { id: string; task_order: string }[]; orderMap: Map<string, string> }
  | { ok: false; reason: "same" | "missing" | "different-parent" };

const byOrder = (a: OrderableTask, b: OrderableTask) => {
  const oa = a.task_order || "";
  const ob = b.task_order || "";
  if (!oa && !ob) return 0;
  if (!oa) return 1;
  if (!ob) return -1;
  return oa.localeCompare(ob, undefined, { numeric: true, sensitivity: "base" });
};

/**
 * ย้าย task ที่ลาก (draggedId) ไปไว้ตำแหน่งของ task เป้าหมาย (targetId) ในกลุ่มเดียวกัน
 * แล้วคำนวณเลขลำดับใหม่แบบลำดับชั้น (1, 1.1, 1.2, 2 ...)
 *
 * - ไม่แก้ object ที่ส่งเข้ามา (เดิมแก้ props ตรง ๆ ทำให้ UI ไม่อัปเดต)
 * - คืนเฉพาะ task ที่เลขลำดับเปลี่ยนจริง (เดิมส่งทุก task ในโปรเจกต์)
 */
export function computeReorder(tasks: OrderableTask[], draggedId: string, targetId: string): ReorderResult {
  if (draggedId === targetId) return { ok: false, reason: "same" };
  const dragged = tasks.find((t) => t.id === draggedId);
  const target = tasks.find((t) => t.id === targetId);
  if (!dragged || !target) return { ok: false, reason: "missing" };
  if ((dragged.parent_task_id || "") !== (target.parent_task_id || "")) return { ok: false, reason: "different-parent" };

  const children = new Map<string, OrderableTask[]>();
  for (const t of tasks) {
    if (!t.id) continue;
    const p = t.parent_task_id || "";
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(t);
  }
  for (const [p, list] of children) children.set(p, [...list].sort(byOrder));

  const parent = dragged.parent_task_id || "";
  const siblings = [...children.get(parent)!];
  const from = siblings.findIndex((t) => t.id === draggedId);
  const to = siblings.findIndex((t) => t.id === targetId);
  const [moved] = siblings.splice(from, 1);
  siblings.splice(to, 0, moved);
  children.set(parent, siblings);

  const orderMap = new Map<string, string>();
  const visited = new Set<string>();
  const walk = (parentId: string, prefix: string) => {
    (children.get(parentId) || []).forEach((child, i) => {
      const id = child.id as string;
      if (visited.has(id)) return; // กันวงวนจากข้อมูล parent ผิดพลาด
      visited.add(id);
      const order = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      orderMap.set(id, order);
      walk(id, order);
    });
  };
  walk("", "");

  const updates = tasks
    .filter((t) => t.id && orderMap.has(t.id) && orderMap.get(t.id) !== (t.task_order || ""))
    .map((t) => ({ id: t.id as string, task_order: orderMap.get(t.id as string)! }));

  return { ok: true, updates, orderMap };
}
