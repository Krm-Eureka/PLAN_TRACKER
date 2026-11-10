"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Printer, Search, X } from "lucide-react";
import {
  BOARD_CATEGORIES,
  buildWeekBoard,
  type BoardCategory,
  type BoardItem,
  type BoardTask,
} from "@/utils/weeklyBoard";
import {
  addDays,
  formatWeekKey,
  getIsoWeek,
  mondayOfIsoWeek,
  parseWeekKey,
  startOfIsoWeek,
  todayStr,
} from "@/utils/week";

const CATEGORY_STYLE: Record<BoardCategory, { chip: string; card: string; dot: string }> = {
  overdue: { chip: "border-rose-200 bg-rose-50 text-rose-700", card: "border-l-rose-500 bg-rose-50/60", dot: "bg-rose-500" },
  progress: { chip: "border-sky-200 bg-sky-50 text-sky-700", card: "border-l-sky-500 bg-white", dot: "bg-sky-500" },
  review: { chip: "border-violet-200 bg-violet-50 text-violet-700", card: "border-l-violet-500 bg-white", dot: "bg-violet-500" },
  todo: { chip: "border-slate-200 bg-slate-50 text-slate-700", card: "border-l-slate-400 bg-white", dot: "bg-slate-400" },
  hold: { chip: "border-amber-200 bg-amber-50 text-amber-700", card: "border-l-amber-500 bg-amber-50/40", dot: "bg-amber-500" },
  done: { chip: "border-emerald-200 bg-emerald-50 text-emerald-700", card: "border-l-emerald-500 bg-emerald-50/40", dot: "bg-emerald-500" },
};

const THAI_DAYS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function dayLabel(date: string) {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${THAI_MONTHS[m - 1]}`;
}

function rangeLabel(monday: string) {
  const sunday = addDays(monday, 6);
  const [y1, m1, d1] = monday.split("-").map(Number);
  const [y2, m2, d2] = sunday.split("-").map(Number);
  if (y1 !== y2) return `${d1} ${THAI_MONTHS[m1 - 1]} ${y1} – ${d2} ${THAI_MONTHS[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ${THAI_MONTHS[m1 - 1]} – ${d2} ${THAI_MONTHS[m2 - 1]} ${y2}`;
  return `${d1}–${d2} ${THAI_MONTHS[m2 - 1]} ${y2}`;
}

function splitNames(names?: string | null): string[] {
  return String(names || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

export function WeeklyBoard({ tasks }: { tasks: BoardTask[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const today = todayStr();
  const week = parseWeekKey(searchParams.get("week")) ?? getIsoWeek(today);
  const monday = mondayOfIsoWeek(week);
  const isCurrentWeek = monday === startOfIsoWeek(today);

  const [activeCategories, setActiveCategories] = useState<Set<BoardCategory>>(new Set());
  const [assignee, setAssignee] = useState("");
  const [query, setQuery] = useState("");
  const [keyDaysOnly, setKeyDaysOnly] = useState(false);

  const goToWeek = (mondayOfWeek: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const key = formatWeekKey(getIsoWeek(mondayOfWeek));
    if (mondayOfWeek === startOfIsoWeek(today)) params.delete("week");
    else params.set("week", key);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const assignees = useMemo(
    () => [...new Set(tasks.flatMap((t) => splitNames(t.assignee_name)))].sort((a, b) => a.localeCompare(b)),
    [tasks]
  );

  // กรอง assignee + ค้นหา ก่อนสร้างบอร์ด เพื่อให้ตัวนับตรงกับสิ่งที่เห็น
  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (assignee && !splitNames(t.assignee_name).includes(assignee)) return false;
      if (!q) return true;
      return [t.task_name, t.project_code, t.project_name, t.client_name, t.assignee_name]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [tasks, assignee, query]);

  const board = buildWeekBoard(filteredTasks, monday, today);

  const isVisible = (item: BoardItem) =>
    (activeCategories.size === 0 || activeCategories.has(item.category)) &&
    (!keyDaysOnly || item.kind !== "ongoing");

  const toggleCategory = (c: BoardCategory) =>
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const hasFilters = activeCategories.size > 0 || !!assignee || !!query || keyDaysOnly;
  const clearFilters = () => {
    setActiveCategories(new Set());
    setAssignee("");
    setQuery("");
    setKeyDaysOnly(false);
  };

  return (
    <div className="space-y-4">
      {/* หัวกระดาษตอนพิมพ์ */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Weekly Board · W{week.week} · {rangeLabel(monday)}</h1>
        <p className="text-xs text-slate-500">
          {board.counts.all} งาน · {board.projectCount} โปรเจกต์ · พิมพ์เมื่อ {dayLabel(today)}
        </p>
      </div>

      {/* แถบควบคุม */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => goToWeek(addDays(monday, -7))}
              className="p-2 text-slate-600 hover:bg-slate-50 rounded-l-lg"
              aria-label="สัปดาห์ก่อน"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => goToWeek(startOfIsoWeek(today))}
              disabled={isCurrentWeek}
              className="px-3 py-1.5 text-sm font-medium text-slate-700 border-x border-slate-200 hover:bg-slate-50 disabled:text-slate-400 disabled:hover:bg-transparent"
            >
              สัปดาห์นี้
            </button>
            <button
              type="button"
              onClick={() => goToWeek(addDays(monday, 7))}
              className="p-2 text-slate-600 hover:bg-slate-50 rounded-r-lg"
              aria-label="สัปดาห์ถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">
              W{week.week} · {rangeLabel(monday)}
            </div>
            <div className="text-xs text-slate-500">
              {board.counts.all} งาน · {board.projectCount} โปรเจกต์
            </div>
          </div>

          <input
            type="week"
            value={formatWeekKey(week)}
            onChange={(e) => {
              const picked = parseWeekKey(e.target.value);
              if (picked) goToWeek(mondayOfIsoWeek(picked));
            }}
            className="ml-auto rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
            aria-label="เลือกสัปดาห์"
          />
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="w-4 h-4" /> พิมพ์
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหา task / รหัสโปรเจกต์ / ลูกค้า / ผู้รับผิดชอบ"
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
            aria-label="กรองตามผู้รับผิดชอบ"
          >
            <option value="">ทุกคน</option>
            {assignees.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-sm text-slate-600 select-none">
            <input
              type="checkbox"
              checked={keyDaysOnly}
              onChange={(e) => setKeyDaysOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            เฉพาะวันเริ่ม/วันส่ง
          </label>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
              <X className="w-3.5 h-3.5" /> ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* ชิปสถานะพร้อมตัวนับ — กดเพื่อกรอง */}
        <div className="flex flex-wrap gap-2">
          {BOARD_CATEGORIES.map(({ key, label }) => {
            const active = activeCategories.has(key);
            const count = board.counts[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleCategory(key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${CATEGORY_STYLE[key].chip} ${
                  active ? "ring-2 ring-offset-1 ring-slate-400" : activeCategories.size > 0 ? "opacity-50" : ""
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${CATEGORY_STYLE[key].dot}`} />
                {label}
                <span className="font-semibold tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* บอร์ด 7 วัน: มือถือเรียงลงมา, จอใหญ่ 7 คอลัมน์ */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7 print:grid-cols-7 print:gap-1">
        {board.days.map((day, i) => {
          const items = day.items.filter(isVisible);
          const isToday = day.date === today;
          const isWeekend = i >= 5;
          return (
            <section
              key={day.date}
              className={`flex flex-col rounded-xl border bg-white shadow-sm print:shadow-none print:break-inside-avoid ${
                isToday ? "border-emerald-400 ring-1 ring-emerald-200" : "border-slate-200"
              } ${isWeekend ? "bg-slate-50/70" : ""}`}
            >
              <header className={`flex items-baseline justify-between border-b px-3 py-2 ${isToday ? "border-emerald-200 bg-emerald-50/70" : "border-slate-100"}`}>
                <h2 className="text-sm font-semibold text-slate-800">
                  {THAI_DAYS[i]} {dayLabel(day.date)}
                  {isToday && <span className="ml-1.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-medium text-white">วันนี้</span>}
                </h2>
                <span className="text-xs text-slate-400 tabular-nums">{items.length}</span>
              </header>
              <ul className="flex-1 space-y-1.5 p-2">
                {items.length === 0 && <li className="py-4 text-center text-xs text-slate-300">—</li>}
                {items.map((item) => (
                  <li key={item.task.id}>
                    <Link
                      href={`/projects/${encodeURIComponent(item.task.project_id)}`}
                      className={`block rounded-md border border-slate-200 border-l-4 px-2 py-1.5 text-xs hover:shadow-sm hover:border-slate-300 transition ${CATEGORY_STYLE[item.category].card}`}
                      title={`${item.task.project_name || ""}\n${item.task.task_name}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-slate-700 truncate">{item.task.project_code || "—"}</span>
                        {(item.kind === "start" || item.kind === "single") && (
                          <span className="shrink-0 rounded bg-slate-800/80 px-1 text-[10px] text-white">เริ่ม</span>
                        )}
                        {item.kind === "due" && (
                          <span className="shrink-0 rounded bg-rose-600/90 px-1 text-[10px] text-white">ส่ง</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-slate-800 line-clamp-2">{item.task.task_name}</div>
                      {item.task.assignee_name && (
                        <div className="mt-0.5 truncate text-[11px] text-slate-500">{item.task.assignee_name}</div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
