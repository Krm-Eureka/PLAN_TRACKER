"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  FolderKanban,
  MessageSquare,
  Plus,
  Search,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api as axios } from "@/lib/axios";
import { showToast } from "@/utils/toast";
import {
  ISSUE_STATUSES,
  MAX_ISSUE_DESCRIPTION_LENGTH,
} from "@/constants/issues";

export interface IssueItem {
  id: string;
  issue_code: string;
  project_id: string;
  project_code: string;
  project_name: string;
  reporter_name: string;
  description: string;
  status: string;
  source: string;
  created_at: string;
  resolved_at: string | null;
}

export interface IssueProjectOption {
  id: string;
  project_code: string;
  project_name: string;
}

const ISSUE_STATUS_OPTIONS = ISSUE_STATUSES;

const STATUS_BADGE_CLASS: Record<string, string> = {
  Open: "bg-rose-50 text-rose-700 border-rose-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Closed: "bg-slate-100 text-slate-600 border-slate-200",
};

export function IssueListSection({
  initialIssues,
  projects,
  fixedProjectId,
  groupByProject = true,
}: {
  initialIssues: IssueItem[];
  projects: IssueProjectOption[];
  fixedProjectId?: string;
  groupByProject?: boolean;
}) {
  const router = useRouter();
  const [issues, setIssues] = useState<IssueItem[]>(initialIssues);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(
    fixedProjectId || projects[0]?.id || ""
  );
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredIssues = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.issue_code.toLowerCase().includes(q) ||
        item.project_code.toLowerCase().includes(q) ||
        item.project_name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.reporter_name.toLowerCase().includes(q)
      );
    });
  }, [issues, statusFilter, search]);

  const groupedProjects = useMemo(() => {
    const map = new Map<
      string,
      {
        project_id: string;
        project_code: string;
        project_name: string;
        items: IssueItem[];
      }
    >();

    for (const item of filteredIssues) {
      const existing = map.get(item.project_id);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(item.project_id, {
          project_id: item.project_id,
          project_code: item.project_code,
          project_name: item.project_name,
          items: [item],
        });
      }
    }

    return Array.from(map.values());
  }, [filteredIssues]);

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProjectId = fixedProjectId || selectedProjectId;
    if (!targetProjectId || !description.trim()) {
      showToast.error("กรุณาเลือกโปรเจกต์และกรอกรายละเอียดปัญหา");
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post("/api/issues", {
        project_id: targetProjectId,
        description: description.trim(),
      });
      if (res.data?.status === "success") {
        const created = res.data.data;
        setIssues((prev) => [
          {
            id: created.id,
            issue_code: created.issue_code,
            project_id: created.project_id,
            project_code: created.project_code,
            project_name: created.project_name,
            reporter_name: created.reporter_name,
            description: created.description,
            status: created.status,
            source: created.source,
            created_at:
              typeof created.created_at === "string"
                ? created.created_at
                : new Date().toISOString(),
            resolved_at: null,
          },
          ...prev,
        ]);
        setDescription("");
        setShowForm(false);
        showToast.success(`บันทึกปัญหา ${created.issue_code} เรียบร้อยแล้ว`);
        router.refresh();
      }
    } catch (error: any) {
      showToast.error(
        error?.response?.data?.message || "ไม่สามารถบันทึกปัญหาได้"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (issueId: string, nextStatus: string) => {
    setUpdatingId(issueId);
    try {
      const res = await axios.patch(`/api/issues/${issueId}`, {
        status: nextStatus,
      });
      if (res.data?.status === "success") {
        setIssues((prev) =>
          prev.map((item) =>
            item.id === issueId
              ? {
                  ...item,
                  status: res.data.data.status,
                  resolved_at: res.data.data.resolved_at,
                }
              : item
          )
        );
        showToast.success(`อัปเดตสถานะเป็น ${nextStatus} แล้ว`);
        router.refresh();
      }
    } catch (error: any) {
      showToast.error(
        error?.response?.data?.message || "ไม่สามารถอัปเดตสถานะได้"
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const renderIssueRow = (item: IssueItem) => (
    <div
      key={item.id}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3.5 hover:border-slate-300 transition-colors"
    >
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            {item.issue_code}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
              STATUS_BADGE_CLASS[item.status] || STATUS_BADGE_CLASS.Open
            }`}
          >
            {item.status}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
            {item.source === "LINE" ? (
              <MessageSquare className="w-3 h-3 text-emerald-600" />
            ) : (
              <Globe className="w-3 h-3 text-sky-600" />
            )}
            {item.source}
          </span>
        </div>
        <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">
          {item.description}
        </p>
        <p className="text-xs text-slate-500">
          ผู้แจ้ง: {item.reporter_name} ·{" "}
          {new Date(item.created_at).toLocaleString("th-TH")}
        </p>
      </div>

      <div className="shrink-0">
        <select
          aria-label={`สถานะของ ${item.issue_code}`}
          value={item.status}
          disabled={updatingId === item.id}
          onChange={(e) => handleStatusChange(item.id, e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        >
          {ISSUE_STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {["ALL", ...ISSUE_STATUS_OPTIONS].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                statusFilter === st
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {st === "ALL" ? "ทั้งหมด" : st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหารหัส / ปัญหา / ผู้แจ้ง..."
              className="w-full h-9 pl-8 pr-3 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowForm((v) => !v)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
          >
            <Plus className="w-4 h-4 mr-1" />
            แจ้งปัญหาใหม่
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="pt-4">
            <form onSubmit={handleCreateIssue} className="space-y-3">
              {!fixedProjectId && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Project
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_code} · {p.project_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  รายละเอียดปัญหา (ไม่กระทบวันที่ Master Plan)
                </label>
                <textarea
                  rows={3}
                  maxLength={MAX_ISSUE_DESCRIPTION_LENGTH}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ระบุปัญหาที่พบ..."
                  className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <div className="mt-1 text-right text-[11px] text-slate-400 tabular-nums">
                  {description.length}/{MAX_ISSUE_DESCRIPTION_LENGTH}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowForm(false)}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || !description.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {submitting ? "กำลังบันทึก..." : "บันทึกปัญหา"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {filteredIssues.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-slate-400">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">ยังไม่มีรายการปัญหาในเงื่อนไขที่เลือก</p>
        </div>
      ) : groupByProject ? (
        <div className="space-y-4">
          {groupedProjects.map((group) => {
            const openCount = group.items.filter(
              (i) => i.status === "Open" || i.status === "In Progress"
            ).length;
            return (
              <Card key={group.project_id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <Link
                      href={`/projects/${group.project_id}?tab=issues`}
                      className="flex items-center gap-2 text-slate-900 hover:text-emerald-700 transition-colors"
                    >
                      <FolderKanban className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        {group.project_code} · {group.project_name}
                      </span>
                    </Link>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {openCount > 0
                        ? `ค้าง ${openCount} / ทั้งหมด ${group.items.length}`
                        : `ทั้งหมด ${group.items.length}`}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {group.items.map(renderIssueRow)}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2.5">{filteredIssues.map(renderIssueRow)}</div>
      )}
    </div>
  );
}
