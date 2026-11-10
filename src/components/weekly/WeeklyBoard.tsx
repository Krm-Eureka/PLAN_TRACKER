"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, MapPin, Plus, Printer, Search, Users, Video, X } from "lucide-react";
import {
  BOARD_CATEGORIES,
  UNASSIGNED,
  buildRangeBoard,
  buildWorkload,
  dateRange,
  splitAssignees,
  type BoardCategory,
  type BoardItem,
  type BoardTask,
  type RangeBoard,
} from "@/utils/weeklyBoard";
import { addDays, formatWeekKey, getIsoWeek, mondayOfIsoWeek, parseWeekKey, startOfIsoWeek, todayStr, weekDays } from "@/utils/week";
import { TASK_TYPES, getTaskType, type TaskTypeKey } from "@/constants/taskTypes";
import { api as axios } from "@/lib/axios";
import { PlanModal } from "@/components/calendar/PlanModal";
import { MeetingCard, PlanCard } from "@/components/weekly/CalendarItems";
import {
  meetingsByDay,
  monthsInRange,
  plansByDay,
  type DayMeeting,
  type DayPlan,
  type RawMeeting,
  type RawPlan,
} from "@/utils/calendarLayers";

export interface BoardUser {
  id: string;
  name_en: string | null;
  name_th: string | null;
  email: string | null;
}

export interface BoardProject {
  id: string;
  project_code: string;
  project_name: string;
  client_name?: string;
}

type Layer = "tasks" | "plans" | "meetings";
type DayExtras = { plans: DayPlan[]; meetings: DayMeeting[] };
const NO_EXTRAS: DayExtras = { plans: [], meetings: [] };

type View = "week" | "month" | "workload";

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
const THAI_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

const NO_TYPE = "none";

function dayLabel(date: string) {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${THAI_MONTHS[m - 1]}`;
}

function weekRangeLabel(monday: string) {
  const sunday = addDays(monday, 6);
  const [y1, m1, d1] = monday.split("-").map(Number);
  const [y2, m2, d2] = sunday.split("-").map(Number);
  if (y1 !== y2) return `${d1} ${THAI_MONTHS[m1 - 1]} ${y1} – ${d2} ${THAI_MONTHS[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ${THAI_MONTHS[m1 - 1]} – ${d2} ${THAI_MONTHS[m2 - 1]} ${y2}`;
  return `${d1}–${d2} ${THAI_MONTHS[m2 - 1]} ${y2}`;
}

function parseMonthKey(key: string | null): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(key || ""));
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return `${m[1]}-${m[2]}`;
}

function shiftMonth(monthKey: string, delta: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonth(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function TypeCode({ type }: { type?: TaskTypeKey | null }) {
  const t = getTaskType(type);
  if (!t) return null;
  return (
    <span className={`shrink-0 rounded border px-1 text-[10px] font-semibold leading-4 ${t.chip}`} title={t.label}>
      {t.code}
    </span>
  );
}

export function WeeklyBoard({
  tasks,
  users = [],
  projects = [],
}: {
  tasks: BoardTask[];
  users?: BoardUser[];
  projects?: BoardProject[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const today = todayStr();
  const viewParam = searchParams.get("view");
  const view: View = viewParam === "month" || viewParam === "workload" ? viewParam : "week";
  const week = parseWeekKey(searchParams.get("week")) ?? getIsoWeek(today);
  const monday = mondayOfIsoWeek(week);
  const monthKey = parseMonthKey(searchParams.get("month")) ?? today.slice(0, 7);

  const [activeCategories, setActiveCategories] = useState<Set<BoardCategory>>(new Set());
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [assignee, setAssignee] = useState("");
  const [query, setQuery] = useState("");
  const [keyDaysOnly, setKeyDaysOnly] = useState(false);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ tasks: true, plans: true, meetings: true });
  const [planModal, setPlanModal] = useState<{ date: Date; initial: RawPlan | null } | null>(null);

  const setParams = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const goToWeek = (mondayOfWeek: string) =>
    setParams({ week: mondayOfWeek === startOfIsoWeek(today) ? null : formatWeekKey(getIsoWeek(mondayOfWeek)) });
  const goToMonth = (key: string) => setParams({ month: key === today.slice(0, 7) ? null : key });
  const setView = (v: View) => setParams({ view: v === "week" ? null : v });

  const assignees = useMemo(
    () => [...new Set(tasks.flatMap((t) => splitAssignees(t.assignee_name)))].filter((n) => n !== UNASSIGNED).sort((a, b) => a.localeCompare(b)),
    [tasks]
  );

  // ตัวกรองคน / ค้นหา / ประเภท ใช้ก่อนสร้างบอร์ด ตัวนับจึงตรงกับสิ่งที่เห็น
  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (assignee && !splitAssignees(t.assignee_name).includes(assignee)) return false;
      if (activeTypes.size > 0 && !activeTypes.has(t.task_type || NO_TYPE)) return false;
      if (!q) return true;
      return [t.task_name, t.project_code, t.project_name, t.client_name, t.assignee_name].some((v) =>
        String(v || "").toLowerCase().includes(q)
      );
    });
  }, [tasks, assignee, query, activeTypes]);

  // ช่วงวันของแต่ละมุมมอง
  const monthStart = `${monthKey}-01`;
  const monthEnd = lastDayOfMonth(monthKey);
  const rangeDates =
    view === "month" ? dateRange(startOfIsoWeek(monthStart), addDays(startOfIsoWeek(monthEnd), 6)) : weekDays(monday);
  const board: RangeBoard = buildRangeBoard(filteredTasks, rangeDates, today);

  // ตัวนับของเดือน: นับเฉพาะวันในเดือนนั้น (ไม่รวมวันของเดือนข้างเคียงที่โผล่ในตาราง)
  const countBoard: RangeBoard =
    view === "month" ? buildRangeBoard(filteredTasks, dateRange(monthStart, monthEnd), today) : board;

  // ตัวนับประเภทงาน (ไม่สนตัวกรองประเภท เพื่อให้เห็นภาพรวม)
  const typeCounts = (() => {
    const unfiltered = tasks.filter((t) => {
      if (assignee && !splitAssignees(t.assignee_name).includes(assignee)) return false;
      const q = query.trim().toLowerCase();
      return !q || [t.task_name, t.project_code, t.project_name, t.client_name, t.assignee_name].some((v) => String(v || "").toLowerCase().includes(q));
    });
    const b = buildRangeBoard(unfiltered, view === "month" ? dateRange(monthStart, monthEnd) : weekDays(monday), today);
    const seen = new Map<string, string>();
    for (const d of b.days) for (const i of d.items) seen.set(i.task.id, i.task.task_type || NO_TYPE);
    const counts: Record<string, number> = {};
    for (const v of seen.values()) counts[v] = (counts[v] || 0) + 1;
    return counts;
  })();

  // ---- แผน (Plan) และประชุม (Google Calendar) ของเดือนที่อยู่ในช่วงที่แสดง ----
  const monthsKey = monthsInRange(rangeDates[0], rangeDates[rangeDates.length - 1]).join(",");
  const [layerData, setLayerData] = useState<{ key: string; plans: RawPlan[]; meetings: RawMeeting[]; meetingsFailed: boolean } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const months = monthsKey.split(",").filter(Boolean);
    (async () => {
      const results = await Promise.all(
        months.map(async (m) => {
          const [y, mo] = m.split("-").map(Number);
          const [pRes, eRes] = await Promise.all([
            axios.get(`/api/plans?year=${y}&month=${mo}`).catch(() => null),
            axios.get(`/api/calendar/events?year=${y}&month=${mo}`).catch(() => null),
          ]);
          return {
            plans: (pRes?.data?.data ?? []) as RawPlan[],
            meetings: (eRes?.data?.data ?? []) as RawMeeting[],
            meetingsFailed: !eRes,
          };
        })
      );
      if (cancelled) return;
      const planById = new Map<string, RawPlan>();
      for (const r of results) for (const pl of r.plans) planById.set(pl.id, pl);
      setLayerData({
        key: monthsKey,
        plans: [...planById.values()],
        meetings: results.flatMap((r) => r.meetings),
        meetingsFailed: results.some((r) => r.meetingsFailed),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [monthsKey, reloadTick]);

  const layerLoading = layerData?.key !== monthsKey;
  const nameOf = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? u.name_en || u.name_th || u.email || undefined : undefined;
  };
  const q = query.trim().toLowerCase();
  const planMap = plansByDay(
    (layerData?.plans ?? []).filter((pl) => {
      const people = [pl.name || "", ...String(pl.companions || "").split(",").map((c) => nameOf(c.trim()) || "")];
      if (assignee && !people.includes(assignee)) return false;
      return !q || [pl.location, pl.plan_detail, ...people].some((v) => String(v || "").toLowerCase().includes(q));
    }),
    nameOf
  );
  const meetingMap = meetingsByDay(
    (layerData?.meetings ?? []).filter((m) => !q || [m.summary, m.location].some((v) => String(v || "").toLowerCase().includes(q)))
  );
  const extrasFor = (date: string): DayExtras => ({
    plans: layers.plans ? planMap.get(date) ?? [] : [],
    meetings: layers.meetings ? meetingMap.get(date) ?? [] : [],
  });
  const periodDates = view === "month" ? dateRange(monthStart, monthEnd) : weekDays(monday);
  const layerCounts = {
    plans: new Set(periodDates.flatMap((d) => (planMap.get(d) ?? []).map((x) => x.plan.id))).size,
    meetings: new Set(periodDates.flatMap((d) => (meetingMap.get(d) ?? []).map((x) => `${x.meeting.id}|${x.meeting.start}`))).size,
  };
  const openNewPlan = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    setPlanModal({ date: new Date(y, m - 1, d), initial: null });
  };
  const openPlan = (pl: RawPlan) => {
    const [y, m, d] = String(pl.start_date || today).slice(0, 10).split("-").map(Number);
    setPlanModal({ date: new Date(y, m - 1, d), initial: pl });
  };
  const defaultPlanDate =
    today >= rangeDates[0] && today <= rangeDates[rangeDates.length - 1] && (view !== "month" || today.startsWith(monthKey))
      ? today
      : view === "month"
        ? monthStart
        : rangeDates[0];

  const isVisible = (item: BoardItem) =>
    (activeCategories.size === 0 || activeCategories.has(item.category)) && (!keyDaysOnly || item.kind !== "ongoing");

  const toggle = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  const hasFilters = activeCategories.size > 0 || activeTypes.size > 0 || !!assignee || !!query || keyDaysOnly;
  const clearFilters = () => {
    setActiveCategories(new Set());
    setActiveTypes(new Set());
    setAssignee("");
    setQuery("");
    setKeyDaysOnly(false);
  };

  const isCurrentPeriod = view === "month" ? monthKey === today.slice(0, 7) : monday === startOfIsoWeek(today);
  const [mY, mM] = monthKey.split("-").map(Number);
  const periodLabel = view === "month" ? `${THAI_MONTHS_FULL[mM - 1]} ${mY}` : `W${week.week} · ${weekRangeLabel(monday)}`;
  const goPrev = () => (view === "month" ? goToMonth(shiftMonth(monthKey, -1)) : goToWeek(addDays(monday, -7)));
  const goNext = () => (view === "month" ? goToMonth(shiftMonth(monthKey, 1)) : goToWeek(addDays(monday, 7)));
  const goNow = () => (view === "month" ? goToMonth(today.slice(0, 7)) : goToWeek(startOfIsoWeek(today)));

  const viewTabs: { key: View; label: string; icon: typeof LayoutGrid }[] = [
    { key: "week", label: "สัปดาห์", icon: LayoutGrid },
    { key: "month", label: "เดือน", icon: CalendarDays },
    { key: "workload", label: "ภาระงานต่อคน", icon: Users },
  ];

  return (
    <div className="space-y-4">
      {/* หัวกระดาษตอนพิมพ์ */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Team Board · {periodLabel}</h1>
        <p className="text-xs text-slate-500">
          {countBoard.counts.all} งาน · {countBoard.projectCount} โปรเจกต์ · พิมพ์เมื่อ {dayLabel(today)}
        </p>
      </div>

      {/* แถบควบคุม */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist" aria-label="มุมมอง">
            {viewTabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  view === key ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-lg border border-slate-200">
            <button type="button" onClick={goPrev} className="p-2 text-slate-600 hover:bg-slate-50 rounded-l-lg" aria-label="ก่อนหน้า">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goNow}
              disabled={isCurrentPeriod}
              className="px-3 py-1.5 text-sm font-medium text-slate-700 border-x border-slate-200 hover:bg-slate-50 disabled:text-slate-400 disabled:hover:bg-transparent"
            >
              {view === "month" ? "เดือนนี้" : "สัปดาห์นี้"}
            </button>
            <button type="button" onClick={goNext} className="p-2 text-slate-600 hover:bg-slate-50 rounded-r-lg" aria-label="ถัดไป">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-900">{periodLabel}</div>
            <div className="text-xs text-slate-500">
              {countBoard.counts.all} งาน · {countBoard.projectCount} โปรเจกต์
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {view === "month" ? (
              <input
                type="month"
                value={monthKey}
                onChange={(e) => {
                  const k = parseMonthKey(e.target.value);
                  if (k) goToMonth(k);
                }}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                aria-label="เลือกเดือน"
              />
            ) : (
              <input
                type="week"
                value={formatWeekKey(week)}
                onChange={(e) => {
                  const picked = parseWeekKey(e.target.value);
                  if (picked) goToWeek(mondayOfIsoWeek(picked));
                }}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                aria-label="เลือกสัปดาห์"
              />
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="w-4 h-4" /> พิมพ์
            </button>
          </div>
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
          {view === "week" && (
            <label className="inline-flex items-center gap-1.5 text-sm text-slate-600 select-none">
              <input type="checkbox" checked={keyDaysOnly} onChange={(e) => setKeyDaysOnly(e.target.checked)} className="rounded border-slate-300" />
              เฉพาะวันเริ่ม/วันส่ง
            </label>
          )}
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
              <X className="w-3.5 h-3.5" /> ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* ชั้นข้อมูล */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 w-14">แสดง</span>
          {([
            { key: "tasks", label: "งาน", icon: LayoutGrid, on: "border-emerald-300 bg-emerald-50 text-emerald-800", count: countBoard.counts.all },
            { key: "plans", label: "แผน/ออกหน้างาน", icon: MapPin, on: "border-teal-300 bg-teal-50 text-teal-800", count: layerCounts.plans },
            { key: "meetings", label: "ประชุม", icon: Video, on: "border-indigo-300 bg-indigo-50 text-indigo-800", count: layerCounts.meetings },
          ] as const).map(({ key, label, icon: Icon, on, count }) => (
            <button
              key={key}
              type="button"
              aria-pressed={layers[key]}
              onClick={() => setLayers((l) => ({ ...l, [key]: !l[key] }))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
                layers[key] ? on : "border-slate-200 bg-white text-slate-400 line-through"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              <span className="font-semibold tabular-nums">{key === "tasks" || !layerLoading ? count : "…"}</span>
            </button>
          ))}
          {layerData?.meetingsFailed && layers.meetings && (
            <span className="text-xs text-amber-600">โหลดปฏิทิน Google ไม่ได้ (ลอง login ใหม่)</span>
          )}
          <button
            type="button"
            onClick={() => openNewPlan(defaultPlanDate)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 print:hidden"
          >
            <Plus className="w-4 h-4" /> เพิ่มแผน
          </button>
        </div>

        {/* สถานะ */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 w-14">สถานะ</span>
          {BOARD_CATEGORIES.map(({ key, label }) => {
            const active = activeCategories.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveCategories((s) => toggle(s, key))}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${CATEGORY_STYLE[key].chip} ${
                  active ? "ring-2 ring-offset-1 ring-slate-400" : activeCategories.size > 0 ? "opacity-50" : ""
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${CATEGORY_STYLE[key].dot}`} />
                {label}
                <span className="font-semibold tabular-nums">{countBoard.counts[key]}</span>
              </button>
            );
          })}
        </div>

        {/* ประเภทงาน */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 w-14">ประเภท</span>
          {[...TASK_TYPES, { key: NO_TYPE, code: "—", label: "ไม่ระบุ", chip: "bg-white text-slate-500 border-slate-200 border-dashed", dot: "bg-slate-300" }].map((t) => {
            const active = activeTypes.has(t.key);
            const count = typeCounts[t.key] || 0;
            if (count === 0 && !active) return null;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTypes((s) => toggle(s, t.key))}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition ${t.chip} ${
                  active ? "ring-2 ring-offset-1 ring-slate-400" : activeTypes.size > 0 ? "opacity-50" : ""
                }`}
                title={t.label}
              >
                <span className="font-bold">{t.code}</span>
                {t.label}
                <span className="font-semibold tabular-nums">{count}</span>
              </button>
            );
          })}
          {Object.keys(typeCounts).length === 0 && <span className="text-xs text-slate-400">— ไม่มีงานในช่วงนี้ —</span>}
        </div>
      </div>

      {view === "week" && (
        <WeekGrid
          board={board}
          today={today}
          isVisible={(i) => layers.tasks && isVisible(i)}
          extrasFor={extrasFor}
          onAddPlan={openNewPlan}
          onOpenPlan={openPlan}
        />
      )}
      {view === "month" && (
        <MonthGrid
          board={board}
          today={today}
          monthKey={monthKey}
          isVisible={(i) => layers.tasks && isVisible(i)}
          extrasFor={extrasFor}
          onOpenPlan={openPlan}
          onAddPlan={openNewPlan}
          onOpenWeek={(date) => setParams({ view: null, week: formatWeekKey(getIsoWeek(date)) })}
        />
      )}
      {view === "workload" && <WorkloadTable board={board} today={today} />}

      <PlanModal
        isOpen={!!planModal}
        onClose={() => setPlanModal(null)}
        onSaved={() => {
          setPlanModal(null);
          setReloadTick((t) => t + 1);
        }}
        selectedDate={planModal?.date ?? null}
        initialData={planModal?.initial ?? null}
        projects={projects}
        users={users.map((u) => ({ id: u.id, name_en: u.name_en ?? undefined, name_th: u.name_th ?? undefined, email: u.email ?? undefined }))}
        tasks={tasks.map((t) => ({ id: t.id, task_name: t.task_name, project_id: t.project_id, project_code: t.project_code ?? undefined }))}
      />
    </div>
  );
}

function TaskCard({ item }: { item: BoardItem }) {
  return (
    <Link
      href={`/projects/${encodeURIComponent(item.task.project_id)}`}
      className={`block rounded-md border border-slate-200 border-l-4 px-2 py-1.5 text-xs hover:shadow-sm hover:border-slate-300 transition ${CATEGORY_STYLE[item.category].card}`}
      title={`${item.task.project_name || ""}\n${item.task.task_name}`}
    >
      <div className="flex items-center gap-1">
        <TypeCode type={item.task.task_type} />
        <span className="font-semibold text-slate-700 truncate">{item.task.project_code || "—"}</span>
        <span className="ml-auto flex shrink-0 gap-1">
          {(item.kind === "start" || item.kind === "single") && (
            <span className="rounded bg-slate-800/80 px-1 text-[10px] text-white">เริ่ม</span>
          )}
          {item.kind === "due" && <span className="rounded bg-rose-600/90 px-1 text-[10px] text-white">ส่ง</span>}
        </span>
      </div>
      <div className="mt-0.5 text-slate-800 line-clamp-2">{item.task.task_name}</div>
      {item.task.assignee_name && <div className="mt-0.5 truncate text-[11px] text-slate-500">{item.task.assignee_name}</div>}
    </Link>
  );
}

function WeekGrid({
  board,
  today,
  isVisible,
  extrasFor,
  onAddPlan,
  onOpenPlan,
}: {
  board: RangeBoard;
  today: string;
  isVisible: (i: BoardItem) => boolean;
  extrasFor: (date: string) => DayExtras;
  onAddPlan: (date: string) => void;
  onOpenPlan: (plan: RawPlan) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7 print:grid-cols-7 print:gap-1">
      {board.days.map((day, i) => {
        const items = day.items.filter(isVisible);
        const extras = extrasFor(day.date);
        const total = items.length + extras.plans.length + extras.meetings.length;
        const isToday = day.date === today;
        return (
          <section
            key={day.date}
            className={`flex flex-col rounded-xl border bg-white shadow-sm print:shadow-none print:break-inside-avoid ${
              isToday ? "border-emerald-400 ring-1 ring-emerald-200" : "border-slate-200"
            } ${i >= 5 ? "bg-slate-50/70" : ""}`}
          >
            <header className={`flex items-baseline justify-between border-b px-3 py-2 ${isToday ? "border-emerald-200 bg-emerald-50/70" : "border-slate-100"}`}>
              <h2 className="text-sm font-semibold text-slate-800">
                {THAI_DAYS[i]} {dayLabel(day.date)}
                {isToday && <span className="ml-1.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-medium text-white">วันนี้</span>}
              </h2>
              <span className="flex items-center gap-1">
                <span className="text-xs text-slate-400 tabular-nums">{total}</span>
                <button
                  type="button"
                  onClick={() => onAddPlan(day.date)}
                  className="rounded p-0.5 text-slate-400 hover:bg-teal-50 hover:text-teal-700 print:hidden"
                  title="เพิ่มแผนวันนี้"
                  aria-label={`เพิ่มแผน ${dayLabel(day.date)}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </span>
            </header>
            <ul className="flex-1 space-y-1.5 p-2">
              {total === 0 && <li className="py-4 text-center text-xs text-slate-300">—</li>}
              {extras.meetings.map((m) => (
                <li key={`m-${m.meeting.id}-${m.meeting.start}`}>
                  <MeetingCard item={m} />
                </li>
              ))}
              {extras.plans.map((pl) => (
                <li key={`p-${pl.plan.id}`}>
                  <PlanCard item={pl} onOpen={() => onOpenPlan(pl.plan)} />
                </li>
              ))}
              {items.map((item) => (
                <li key={item.task.id}>
                  <TaskCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const MONTH_CELL_LIMIT = 3;

function MonthGrid({
  board,
  today,
  monthKey,
  isVisible,
  extrasFor,
  onOpenPlan,
  onAddPlan,
  onOpenWeek,
}: {
  board: RangeBoard;
  today: string;
  monthKey: string;
  isVisible: (i: BoardItem) => boolean;
  extrasFor: (date: string) => DayExtras;
  onOpenPlan: (plan: RawPlan) => void;
  onAddPlan: (date: string) => void;
  onOpenWeek: (date: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500">
        {THAI_DAYS.map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {board.days.map((day, i) => {
          const inMonth = day.date.startsWith(monthKey);
          const items = day.items.filter(isVisible);
          const extras = inMonth ? extrasFor(day.date) : NO_EXTRAS;
          const isToday = day.date === today;
          // ลำดับในช่อง: ประชุม → แผน → งาน (รวมกันไม่เกิน MONTH_CELL_LIMIT)
          const meetingsShown = extras.meetings.slice(0, MONTH_CELL_LIMIT);
          const plansShown = extras.plans.slice(0, MONTH_CELL_LIMIT - meetingsShown.length);
          const shown = items.slice(0, Math.max(0, MONTH_CELL_LIMIT - meetingsShown.length - plansShown.length));
          const total = items.length + extras.plans.length + extras.meetings.length;
          const more = total - shown.length - plansShown.length - meetingsShown.length;
          return (
            <div
              key={day.date}
              className={`min-h-[96px] sm:min-h-[120px] border-b border-r border-slate-100 p-1 sm:p-1.5 ${i % 7 === 6 ? "border-r-0" : ""} ${
                inMonth ? (i % 7 >= 5 ? "bg-slate-50/60" : "bg-white") : "bg-slate-50/80"
              }`}
            >
              <div className="group/cell mb-1 flex items-center justify-between">
                <span
                  className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${
                    isToday ? "bg-emerald-600 font-semibold text-white" : inMonth ? "text-slate-700" : "text-slate-300"
                  }`}
                >
                  {Number(day.date.slice(8))}
                </span>
                <span className="flex items-center gap-0.5">
                  {inMonth && (
                    <button
                      type="button"
                      onClick={() => onAddPlan(day.date)}
                      className="rounded p-0.5 text-slate-300 opacity-0 hover:bg-teal-50 hover:text-teal-700 group-hover/cell:opacity-100 focus:opacity-100 print:hidden"
                      title="เพิ่มแผน"
                      aria-label={`เพิ่มแผน ${dayLabel(day.date)}`}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                  {total > 0 && <span className="text-[10px] text-slate-400 tabular-nums">{total}</span>}
                </span>
              </div>
              {inMonth && (
                <ul className="space-y-0.5">
                  {meetingsShown.map((m) => (
                    <li key={`m-${m.meeting.id}-${m.meeting.start}`}>
                      <MeetingCard item={m} compact />
                    </li>
                  ))}
                  {plansShown.map((pl) => (
                    <li key={`p-${pl.plan.id}`}>
                      <PlanCard item={pl} onOpen={() => onOpenPlan(pl.plan)} compact />
                    </li>
                  ))}
                  {shown.map((item) => (
                    <li key={item.task.id}>
                      <Link
                        href={`/projects/${encodeURIComponent(item.task.project_id)}`}
                        className={`flex items-center gap-1 rounded border-l-2 px-1 py-0.5 text-[11px] leading-tight hover:bg-slate-100 ${CATEGORY_STYLE[item.category].card}`}
                        title={`${item.task.project_code || ""} · ${item.task.task_name}${item.task.assignee_name ? `\n${item.task.assignee_name}` : ""}`}
                      >
                        <TypeCode type={item.task.task_type} />
                        <span className="truncate text-slate-700">{item.task.task_name}</span>
                      </Link>
                    </li>
                  ))}
                  {more > 0 && (
                    <li>
                      <button
                        type="button"
                        onClick={() => onOpenWeek(day.date)}
                        className="w-full rounded px-1 text-left text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 print:hidden"
                      >
                        +{more} ดูทั้งสัปดาห์
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** สีความหนาแน่นของงานต่อวัน (0, 1, 2, 3, 4+) */
function loadClass(n: number) {
  if (n <= 0) return "bg-white text-slate-300";
  if (n === 1) return "bg-emerald-50 text-emerald-700";
  if (n === 2) return "bg-emerald-100 text-emerald-800";
  if (n === 3) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800 font-semibold";
}

function WorkloadTable({ board, today }: { board: RangeBoard; today: string }) {
  const rows = buildWorkload(board);
  const busiest = rows.filter((r) => r.person !== UNASSIGNED && r.peak >= 4).map((r) => r.person);

  return (
    <div className="space-y-3">
      {busiest.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 print:hidden">
          มีงานพร้อมกัน 4 งานขึ้นไปในบางวัน: <span className="font-semibold">{busiest.join(", ")}</span> — ลองกระจายงานหรือเลื่อนกำหนดส่ง
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-medium">ผู้รับผิดชอบ</th>
              {board.days.map((d, i) => (
                <th key={d.date} className={`px-1 py-2 text-center font-medium ${d.date === today ? "text-emerald-700" : ""}`}>
                  <div>{THAI_DAYS[i % 7]}</div>
                  <div className="text-[10px] font-normal">{dayLabel(d.date)}</div>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">งานค้าง</th>
              <th className="px-3 py-2 text-right font-medium">เลยกำหนด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={board.days.length + 3} className="py-8 text-center text-slate-400">
                  ไม่มีงานที่ยังไม่เสร็จในช่วงนี้
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.person}>
                <td className={`sticky left-0 z-10 bg-white px-3 py-2 font-medium whitespace-nowrap ${row.person === UNASSIGNED ? "text-slate-400 italic" : "text-slate-800"}`}>
                  {row.person}
                </td>
                {row.perDay.map((n, i) => (
                  <td key={board.days[i].date} className="p-1 text-center">
                    <span className={`inline-flex h-8 w-full min-w-8 items-center justify-center rounded-md tabular-nums ${loadClass(n)}`}>
                      {n > 0 ? n : "·"}
                    </span>
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.openTasks}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${row.overdueTasks > 0 ? "font-semibold text-rose-600" : "text-slate-400"}`}>
                  {row.overdueTasks}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>จำนวนงานที่ยังไม่เสร็จต่อวัน:</span>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className="inline-flex items-center gap-1">
            <span className={`inline-block h-4 w-6 rounded ${loadClass(n)}`} /> {n === 4 ? "4+" : n}
          </span>
        ))}
      </div>
    </div>
  );
}
