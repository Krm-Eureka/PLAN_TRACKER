"use client";

import { MapPin, Users as UsersIcon, Video } from "lucide-react";
import type { DayMeeting, DayPlan } from "@/utils/calendarLayers";

/** แผน: ไปหน้างาน / WFH / ลา */
export function PlanCard({ item, onOpen, compact = false }: { item: DayPlan; onOpen: () => void; compact?: boolean }) {
  const { plan, people } = item;
  const time = plan.start_time ? `${plan.start_time}${plan.end_time ? `–${plan.end_time}` : ""}` : null;
  const title = `${plan.location || "แผนงาน"}\n${people.join(", ")}${time ? `\n${time}` : ""}${plan.plan_detail ? `\n${plan.plan_detail}` : ""}`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpen}
        title={title}
        className="flex w-full items-center gap-1 rounded border-l-2 border-l-teal-500 bg-teal-50/70 px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-teal-100"
      >
        <MapPin className="h-3 w-3 shrink-0 text-teal-600" />
        <span className="truncate text-slate-700">
          {people[0]} · {plan.location || "แผนงาน"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      title={title}
      className="block w-full rounded-md border border-teal-200 border-l-4 border-l-teal-500 bg-teal-50/60 px-2 py-1.5 text-left text-xs hover:shadow-sm"
    >
      <div className="flex items-center gap-1 font-semibold text-teal-800">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">{plan.location || "แผนงาน"}</span>
        {time && <span className="ml-auto shrink-0 text-[10px] font-normal text-teal-700">{time}</span>}
      </div>
      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-600">
        <UsersIcon className="h-3 w-3 shrink-0 text-slate-400" />
        <span className="truncate">{people.join(", ")}</span>
      </div>
    </button>
  );
}

/** ประชุม / นัดหมายจาก Google Calendar */
export function MeetingCard({ item, compact = false }: { item: DayMeeting; compact?: boolean }) {
  const { meeting, time } = item;
  const href = meeting.hangoutLink || meeting.htmlLink || undefined;
  const title = `${meeting.summary}${time ? `\n${time}` : "\nทั้งวัน"}${meeting.location ? `\n${meeting.location}` : ""}`;
  const body = (
    <>
      <Video className="h-3 w-3 shrink-0 text-indigo-500" />
      <span className="shrink-0 tabular-nums text-indigo-700">{time ?? "ทั้งวัน"}</span>
      <span className="truncate text-slate-700">{meeting.summary}</span>
    </>
  );

  if (compact) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
        className="flex items-center gap-1 rounded border-l-2 border-l-indigo-400 bg-indigo-50/70 px-1 py-0.5 text-[11px] leading-tight hover:bg-indigo-100"
      >
        {body}
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="flex items-center gap-1 rounded-md border border-indigo-200 border-l-4 border-l-indigo-400 bg-indigo-50/60 px-2 py-1.5 text-xs hover:shadow-sm"
    >
      {body}
    </a>
  );
}
