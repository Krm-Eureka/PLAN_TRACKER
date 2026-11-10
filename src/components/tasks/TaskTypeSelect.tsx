"use client";

import { TASK_TYPES } from "@/constants/taskTypes";

interface TaskTypeSelectProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
}

/** ช่องเลือกประเภทงาน ใช้ทั้งในฟอร์มสร้างและแก้ไข task */
export function TaskTypeSelect({ value, onChange }: TaskTypeSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">ประเภทงาน</label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors bg-white"
      >
        <option value="">— ไม่ระบุ —</option>
        {TASK_TYPES.map((t) => (
          <option key={t.key} value={t.key}>
            {t.code} · {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
