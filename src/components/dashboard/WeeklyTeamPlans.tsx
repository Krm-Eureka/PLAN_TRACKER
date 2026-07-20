"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarIcon, MapPin, User, Clock, Plus } from "lucide-react"
import { format, parseISO } from "date-fns"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface WeeklyTeamPlansProps {
  plans: any[];
  currentUserId?: string;
}

export function WeeklyTeamPlans({ plans, currentUserId }: WeeklyTeamPlansProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const router = useRouter();

  const handleJoin = async (plan: any) => {
    if (!currentUserId) {
      toast.error("Please login to join a plan");
      return;
    }
    setJoiningId(plan.id || plan.project_code || 'temp');
    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: plan.start_date,
          location: plan.location,
          duration_days: plan.duration_days,
          project_id: plan.project_id,
          plan_detail: plan.plan_detail,
          task_id: plan.task_id || "",
          start_time: plan.start_time || "",
          end_time: plan.end_time || "",
          companions: ""
        })
      });
      if (res.ok) {
        toast.success("Joined plan successfully!");
        router.refresh();
      } else {
        toast.error("Failed to join plan");
      }
    } catch (error) {
      toast.error("Error joining plan");
    } finally {
      setJoiningId(null);
    }
  };

  // Group plans by identical details
  const groupedPlansMap = new Map<string, any>();
  
  plans.forEach(plan => {
    const key = `${plan.project_code || 'none'}_${plan.location || 'none'}_${plan.start_date}_${plan.duration_days}_${plan.plan_detail || 'none'}`;
    
    if (groupedPlansMap.has(key)) {
      const existing = groupedPlansMap.get(key);
      // Check if user is already added to prevent exact duplicates (just in case)
      if (!existing.users.some((u: any) => u.name === plan.name)) {
        existing.users.push({
          id: plan.user_id,
          name: plan.name || 'Unknown User',
          color: plan.user_color || '#94a3b8'
        });
      }
    } else {
      groupedPlansMap.set(key, {
        ...plan,
        users: [{
          id: plan.user_id,
          name: plan.name || 'Unknown User',
          color: plan.user_color || '#94a3b8'
        }]
      });
    }
  });

  const sortedPlans = Array.from(groupedPlansMap.values()).sort((a, b) => {
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  });

  return (
    <Card className="shadow-sm border-slate-200/60 flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-emerald-600" />
          Department Weekly Plans
        </CardTitle>
        <CardDescription>Plans of your department members for this week (Mon-Sun).</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-4">
          {sortedPlans.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
              No plans found for your department this week.
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {sortedPlans.map((plan, idx) => (
                <div key={plan.id || idx} className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-slate-900 text-sm truncate">{plan.location || 'Unknown Location'}</span>
                      <span className="text-xs text-emerald-600 font-medium bg-emerald-50 w-fit px-1.5 py-0.5 rounded border border-emerald-100 truncate">
                        {plan.project_code || 'No Project'}
                      </span>
                    </div>
                    {currentUserId && !plan.users.some((u: any) => u.id === currentUserId) && (
                      <button
                        onClick={() => handleJoin(plan)}
                        disabled={joiningId === (plan.id || plan.project_code || 'temp')}
                        className="text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-200 flex items-center gap-1 transition-colors shrink-0 disabled:opacity-50"
                      >
                        <Plus className="w-3 h-3" />
                        {joiningId === (plan.id || plan.project_code || 'temp') ? 'Joining...' : 'Join'}
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-1.5 mt-3">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {plan.users.map((u: any, idx: number) => (
                        <div 
                          key={idx}
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium"
                          style={{ 
                            backgroundColor: `${u.color || '#94a3b8'}15`, 
                            color: u.color || '#64748b', 
                            border: `1px solid ${u.color || '#cbd5e1'}40` 
                          }}
                        >
                          <User className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[150px]">{u.name || 'Unknown User'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{format(parseISO(plan.start_date), 'EEE, MMM d, yyyy')} ({plan.duration_days} day{parseInt(plan.duration_days) > 1 ? 's' : ''})</span>
                    </div>
                    {plan.plan_detail && (
                      <div 
                        onClick={() => setExpandedId(prev => prev === (plan.id || String(idx)) ? null : (plan.id || String(idx)))}
                        className={`text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors flex flex-col group`}
                      >
                        <div className={`whitespace-pre-wrap ${expandedId === (plan.id || String(idx)) ? '' : 'line-clamp-2'}`}>
                          {plan.plan_detail}
                        </div>
                        <div className="text-emerald-500 font-medium text-[10px] self-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {expandedId === (plan.id || String(idx)) ? 'Show less' : 'Click to read more'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
