"use client";

import { useState } from "react";
import Link from "next/link";
import { Printer, Search } from "lucide-react";
import { isCancelStatus, isDoneStatus, isHoldStatus } from "@/constants/status";
import { todayStr } from "@/utils/week";

export interface TimelineProject {
  id: string;
  code: string;
  name: string;
  client: string | null;
  manager: string | null;
  start: string;
  end: string;
  status: string;
  priority: string | null;
  progress: number;
  taskCount: number;
  overdue: boolean;
}

type Range = "6m" | "year" | "all";
type StatusFilter = "active" | "all" | "done";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const DAY_MS = 86_400_000;

const toMs = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const fmt = (d: string) => `${Number(d.slice(8, 10))} ${THAI_MONTHS[Number(d.slice(5, 7)) - 1]} ${String(d.slice(2, 4))}`;

function barStyle(p: TimelineProject) {
  if (isCancelStatus(p.status)) return { bar: "bg-slate-200 border-slate-300", fill: "bg-slate-300", label: "ยกเลิก" };
  if (isDoneStatus(p.status)) return { bar: "bg-emerald-100 border-emerald-300", fill: "bg-emerald-500", label: "เสร็จแล้ว" };
  if (p.overdue) return { bar: "bg-rose-100 border-rose-300", fill: "bg-rose-500", label: "เลยกำหนด" };
  if (isHoldStatus(p.status)) return { bar: "bg-amber-100 border-amber-300", fill: "bg-amber-500", label: "พักไว้" };
  return { bar: "bg-sky-100 border-sky-300", fill: "bg-sky-500", label: "กำลังดำเนินการ" };
}

/** ต้นเดือนของทุกเดือนในช่วง [startMs, endMs] */
function monthTicks(startMs: number, endMs: number) {
  const d = new Date(startMs);
  let cur = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const out: number[] = [];
  while (cur <= endMs && out.length < 120) {
    out.push(cur);
    const c = new Date(cur);
    cur = Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1);
  }
  return out;
}

export function ProjectTimeline({ projects }: { projects: TimelineProject[] }) {
  const today = todayStr();
  const todayMs = toMs(today);
  const [range, setRange] = useState<Range>("6m");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = projects
    .filter((p) => {
      const done = isDoneStatus(p.status) || isCancelStatus(p.status);
      if (statusFilter === "active" && done) return false;
      if (statusFilter === "done" && !done) return false;
      return !q || [p.code, p.name, p.client, p.manager].some((v) => String(v || "").toLowerCase().includes(q));
    })
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));

  // ช่วงแกนเวลา
  let startMs: number;
  let endMs: number;
  if (range === "6m") {
    const t = new Date(todayMs);
    startMs = Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 2, 1);
    endMs = Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 4, 0);
  } else if (range === "year") {
    const y = new Date(todayMs).getUTCFullYear();
    startMs = Date.UTC(y, 0, 1);
    endMs = Date.UTC(y, 11, 31);
  } else {
    const starts = filtered.map((p) => toMs(p.start));
    const ends = filtered.map((p) => toMs(p.end));
    startMs = starts.length ? Math.min(...starts, todayMs) : todayMs - 90 * DAY_MS;
    endMs = ends.length ? Math.max(...ends, todayMs) : todayMs + 90 * DAY_MS;
    const s = new Date(startMs);
    startMs = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1);
    const e = new Date(endMs);
    endMs = Date.UTC(e.getUTCFullYear(), e.getUTCMonth() + 1, 0);
  }
  const span = Math.max(DAY_MS, endMs - startMs + DAY_MS);
  const pct = (ms: number) => ((ms - startMs) / span) * 100;

  const rows = filtered.filter((p) => toMs(p.end) >= startMs && toMs(p.start) <= endMs);
  const hiddenOutside = filtered.length - rows.length;
  const ticks = monthTicks(startMs, endMs);
  const todayVisible = todayMs >= startMs && todayMs <= endMs;

  const counts = {
    active: projects.filter((p) => !isDoneStatus(p.status) && !isCancelStatus(p.status)).length,
    overdue: projects.filter((p) => p.overdue).length,
  };

  const segBtn = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${active ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm print:hidden">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button type="button" className={segBtn(range === "6m")} onClick={() => setRange("6m")}>6 เดือน</button>
          <button type="button" className={segBtn(range === "year")} onClick={() => setRange("year")}>ปีนี้</button>
          <button type="button" className={segBtn(range === "all")} onClick={() => setRange("all")}>ทั้งหมด</button>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button type="button" className={segBtn(statusFilter === "active")} onClick={() => setStatusFilter("active")}>
            กำลังทำ <span className="tabular-nums text-slate-400">{counts.active}</span>
          </button>
          <button type="button" className={segBtn(statusFilter === "done")} onClick={() => setStatusFilter("done")}>เสร็จ/ยกเลิก</button>
          <button type="button" className={segBtn(statusFilter === "all")} onClick={() => setStatusFilter("all")}>ทั้งหมด</button>
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหารหัส / ชื่อโปรเจกต์ / ลูกค้า / ผู้รับผิดชอบ"
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
        {counts.overdue > 0 && (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
            เลยกำหนด {counts.overdue}
          </span>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Printer className="w-4 h-4" /> พิมพ์
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm print:shadow-none">
        <div className="min-w-[760px]">
          {/* หัวแกนเดือน */}
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
            <div className="w-56 shrink-0 px-3 py-2 font-medium sm:w-72">โปรเจกต์</div>
            <div className="relative h-9 flex-1">
              {ticks.map((t) => {
                const d = new Date(t);
                const left = pct(Math.max(t, startMs));
                return (
                  <div key={t} className="absolute top-0 h-full border-l border-slate-200 pl-1 pt-2 whitespace-nowrap" style={{ left: `${left}%` }}>
                    {THAI_MONTHS[d.getUTCMonth()]}
                    {d.getUTCMonth() === 0 || t === ticks[0] ? ` ${d.getUTCFullYear()}` : ""}
                  </div>
                );
              })}
            </div>
          </div>

          {rows.length === 0 && <div className="py-12 text-center text-sm text-slate-400">ไม่มีโปรเจกต์ในช่วงนี้</div>}

          {rows.map((p) => {
            const s = barStyle(p);
            const left = pct(Math.max(toMs(p.start), startMs));
            const right = pct(Math.min(toMs(p.end), endMs) + DAY_MS);
            const width = Math.max(0.8, right - left);
            return (
              <div key={p.id} className="group flex border-b border-slate-100 hover:bg-slate-50/70">
                <Link href={`/projects/${encodeURIComponent(p.id)}`} className="w-56 shrink-0 px-3 py-2 sm:w-72">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">{p.code}</span>
                    {p.priority?.toLowerCase() === "high" && (
                      <span className="rounded bg-rose-50 px-1 text-[10px] font-medium text-rose-600">High</span>
                    )}
                  </div>
                  <div className="truncate text-sm font-medium text-slate-800 group-hover:text-emerald-700" title={p.name}>
                    {p.name}
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    {[p.client, p.manager].filter(Boolean).join(" · ")}
                  </div>
                </Link>
                <div className="relative flex-1">
                  {ticks.map((t) => (
                    <div key={t} className="absolute top-0 h-full border-l border-slate-100" style={{ left: `${pct(Math.max(t, startMs))}%` }} />
                  ))}
                  {todayVisible && <div className="absolute top-0 z-10 h-full w-px bg-emerald-500/70" style={{ left: `${pct(todayMs)}%` }} />}
                  <Link
                    href={`/projects/${encodeURIComponent(p.id)}`}
                    className={`absolute top-1/2 z-20 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md border ${s.bar} hover:shadow`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${p.code} · ${p.name}\n${fmt(p.start)} – ${fmt(p.end)}\n${s.label} · ${p.progress}% (${p.taskCount} งาน)`}
                  >
                    <div className={`h-full ${s.fill} opacity-80`} style={{ width: `${p.progress}%` }} />
                    <span className="absolute inset-0 flex items-center px-1.5 text-[11px] font-medium text-slate-800 whitespace-nowrap">
                      {p.progress}%
                    </span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {[
          ["bg-sky-500", "กำลังดำเนินการ"],
          ["bg-rose-500", "เลยกำหนด"],
          ["bg-amber-500", "พักไว้"],
          ["bg-emerald-500", "เสร็จแล้ว"],
        ].map(([c, l]) => (
          <span key={l} className="inline-flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded-sm ${c}`} /> {l}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-px bg-emerald-500" /> วันนี้
        </span>
        <span>· แถบทึบ = % ความคืบหน้า</span>
        {hiddenOutside > 0 && <span>· อีก {hiddenOutside} โปรเจกต์อยู่นอกช่วงที่เลือก</span>}
      </div>
    </div>
  );
}
