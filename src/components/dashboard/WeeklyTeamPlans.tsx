"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarIcon, MapPin, User, Clock } from "lucide-react"
import { format, parseISO } from "date-fns"

interface WeeklyTeamPlansProps {
  plans: any[];
}

export function WeeklyTeamPlans({ plans }: WeeklyTeamPlansProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sort plans by start date
  const sortedPlans = [...plans].sort((a, b) => {
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  });

  return (
    <Card className="shadow-sm border-slate-200/60 flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-indigo-600" />
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
                <div key={plan.id || idx} className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-slate-900 text-sm truncate">{plan.location || 'Unknown Location'}</span>
                      <span className="text-xs text-indigo-600 font-medium bg-indigo-50 w-fit px-1.5 py-0.5 rounded border border-indigo-100 truncate">
                        {plan.project_code || 'No Project'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 mt-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{plan.name || 'Unknown User'}</span>
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
                        <div className="text-indigo-500 font-medium text-[10px] self-end mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
