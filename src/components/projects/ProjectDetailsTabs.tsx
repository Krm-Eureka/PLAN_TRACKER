"use client";

import { useState } from "react";
import { AlertTriangle, GanttChartSquare } from "lucide-react";
import { GanttChart } from "@/components/projects/GanttChart";
import { Pagination } from "@/components/ui/Pagination";
import {
  IssueListSection,
  type IssueItem,
  type IssueProjectOption,
} from "@/components/issues/IssueListSection";

export function ProjectDetailsTabs({
  initialTab,
  paginatedTasks,
  project,
  users,
  page,
  totalPages,
  offset,
  limit,
  totalTasks,
  initialIssues,
  projectOption,
}: {
  initialTab: "tasks" | "issues";
  paginatedTasks: any[];
  project: any;
  users: any[];
  page: number;
  totalPages: number;
  offset: number;
  limit: number;
  totalTasks: number;
  initialIssues: IssueItem[];
  projectOption: IssueProjectOption;
}) {
  const [activeTab, setActiveTab] = useState<"tasks" | "issues">(initialTab);
  const openCount = initialIssues.filter(
    (i) => i.status === "Open" || i.status === "In Progress"
  ).length;

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "tasks"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <GanttChartSquare className="w-4 h-4" />
          Tasks &amp; Gantt ({totalTasks})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("issues")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "issues"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Issue Log ({openCount > 0 ? `${openCount} open` : initialIssues.length})
        </button>
      </div>

      {activeTab === "tasks" ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
            <GanttChart tasks={paginatedTasks} project={project} users={users} />
          </div>

          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-sm text-slate-500 font-medium">
                Showing {offset + 1}-{Math.min(offset + limit, totalTasks)} of{" "}
                {totalTasks} tasks
              </div>
              <Pagination currentPage={page} totalPages={totalPages} />
            </div>
          )}
        </div>
      ) : (
        <IssueListSection
          initialIssues={initialIssues}
          projects={[projectOption]}
          fixedProjectId={projectOption.id}
          groupByProject={false}
        />
      )}
    </div>
  );
}
