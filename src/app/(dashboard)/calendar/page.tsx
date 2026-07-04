import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { fetchProjects, fetchRecentTasks } from "@/services/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar as CalendarIcon, Clock, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react"

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;
  
  let projects: any[] = [];
  let tasks: any[] = [];
  let errorMsg = null;

  try {
    if (token) {
      [projects, tasks] = await Promise.all([
        fetchProjects(token).catch(() => []),
        fetchRecentTasks(token).catch(() => [])
      ]);
    }
  } catch (error: any) {
    errorMsg = error.message;
  }

  // Very simple parsing of dates from string to native Date objects
  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // Combine items that have a date
  const events = [
    ...projects.filter(p => p.end_date).map(p => ({
      id: `proj-${p.project_code || Math.random()}`,
      title: p.project_name || 'Untitled Project',
      date: parseDate(p.end_date),
      type: 'Project Deadline',
      status: p.status || 'Unknown',
    })),
    ...tasks.filter(t => t.due_date || t.actual_end_date || t.target_date).map(t => ({
      id: `task-${t.task_id || Math.random()}`,
      title: t.task_name || 'Untitled Task',
      date: parseDate(t.due_date || t.target_date || t.actual_end_date),
      type: 'Task Due',
      status: t.status || 'Unknown',
    }))
  ].filter(e => e.date !== null).sort((a, b) => (a.date!.getTime() - b.date!.getTime()));

  // Group by Month/Year
  const groupedEvents: Record<string, typeof events> = {};
  events.forEach(event => {
    const monthYear = event.date!.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!groupedEvents[monthYear]) groupedEvents[monthYear] = [];
    groupedEvents[monthYear].push(event);
  });

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('done') || s.includes('complete')) return 'bg-emerald-100 text-emerald-700';
    if (s.includes('progress') || s.includes('doing')) return 'bg-blue-100 text-blue-700';
    if (s.includes('hold') || s.includes('wait')) return 'bg-amber-100 text-amber-700';
    if (s.includes('cancel')) return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-8 h-8 text-indigo-600" />
            Schedule & Deadlines
          </h1>
          <p className="text-slate-500 mt-1">Track upcoming project deadlines and task target dates.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Error Loading Calendar</h3>
            <p className="text-sm mt-1">{errorMsg}</p>
          </div>
        </div>
      )}

      {events.length === 0 && !errorMsg ? (
        <Card className="border-dashed border-2 bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <CalendarIcon className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900">No Upcoming Events</h3>
            <p className="text-slate-500 mt-2 max-w-md">
              We couldn't find any tasks or projects with valid dates (e.g. "end_date", "due_date"). 
              Check your Google Sheets to make sure dates are filled in properly.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
          {Object.entries(groupedEvents).map(([month, monthEvents]) => (
            <div key={month} className="relative z-10">
              <div className="sticky top-20 z-20 flex items-center justify-center mb-8">
                <Badge variant="outline" className="bg-white/80 backdrop-blur-sm border-indigo-200 text-indigo-700 px-4 py-1.5 text-sm shadow-sm font-semibold uppercase tracking-widest">
                  {month}
                </Badge>
              </div>
              
              <div className="space-y-6">
                {monthEvents.map((event, i) => (
                  <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 bg-white shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 text-indigo-500 z-10">
                      {event.type.includes('Project') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    </div>
                    
                    <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-white border-slate-100">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            {event.date!.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                          </span>
                          <Badge className={`text-[10px] px-2 py-0.5 font-medium border-0 ${getStatusColor(event.status)}`}>
                            {event.status}
                          </Badge>
                        </div>
                        <h4 className="text-lg font-semibold text-slate-900 leading-tight mb-1">
                          {event.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-3 font-medium">
                          <span className="text-indigo-500">{event.type}</span>
                          <ArrowRight className="w-3.5 h-3.5 opacity-50" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
