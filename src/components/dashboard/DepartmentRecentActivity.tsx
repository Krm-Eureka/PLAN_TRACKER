import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDistanceToNow, parseISO } from "date-fns"
import { Activity } from "lucide-react"

export interface ActivityLogData {
  timestamp?: string;
  created_at?: string | Date;
  action: string;
  project_id?: string;
  project_name?: string;
  user_name?: string;
  user_email?: string;
}

interface DepartmentRecentActivityProps {
  logs: ActivityLogData[];
}

export function DepartmentRecentActivity({ logs }: DepartmentRecentActivityProps) {
  // Normalize timestamp or created_at and sort descending (newest first)
  const sortedLogs = [...(logs || [])]
    .map(log => {
      const rawTime = log.timestamp || log.created_at;
      let timeVal = "";
      if (rawTime instanceof Date) {
        timeVal = rawTime.toISOString();
      } else if (rawTime) {
        timeVal = String(rawTime);
      }
      return {
        ...log,
        normalizedTime: timeVal
      };
    })
    .filter(log => log.normalizedTime)
    .sort((a, b) => new Date(b.normalizedTime).getTime() - new Date(a.normalizedTime).getTime())
    .slice(0, 10); // Show top 10 recent activities

  return (
    <Card className="shadow-sm border-slate-200/60 flex flex-col mt-6 lg:mt-0 max-h-[500px]">
      <CardHeader className="shrink-0 px-5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          <CardTitle>Department Activity</CardTitle>
        </div>
        <CardDescription>Latest updates from your team.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 px-5 overflow-y-auto pt-4">
        {sortedLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedLogs.map((log, index) => {
              const initials = log.user_name ? log.user_name.substring(0, 2).toUpperCase() : 'U';
              let actionColor = "text-slate-600";
              let badgeColor = "bg-slate-100 text-slate-600";
              
              if (log.action?.includes('CREATE')) {
                actionColor = "text-emerald-600";
                badgeColor = "bg-emerald-50 text-emerald-600";
              } else if (log.action?.includes('UPDATE')) {
                actionColor = "text-blue-600";
                badgeColor = "bg-blue-50 text-blue-600";
              } else if (log.action?.includes('DELETE')) {
                actionColor = "text-red-600";
                badgeColor = "bg-red-50 text-red-600";
              }

              let timeAgo = "";
              try {
                const parsed = parseISO(log.normalizedTime);
                if (!isNaN(parsed.getTime())) {
                  timeAgo = formatDistanceToNow(parsed, { addSuffix: true });
                }
              } catch {
                timeAgo = "";
              }

              return (
                <div key={index} className="flex gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-xs text-slate-600 shrink-0 mt-1">
                    {initials}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {log.user_name || "User"}
                    </p>
                    <p className="text-sm text-slate-600 mt-0.5 truncate">
                      <span className={`font-medium ${actionColor}`}>{log.action}</span>
                      {log.project_name ? (
                        <>
                          {" • "}
                          <span className="font-semibold text-slate-700">{log.project_name}</span>
                        </>
                      ) : null}
                    </p>
                    {timeAgo && (
                      <p className="text-xs text-slate-400 mt-1">
                        {timeAgo}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
