import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TaskData } from "@/interfaces"
import { PieChart } from "lucide-react"

interface StatusOverviewProps {
  tasks: TaskData[];
  title?: string;
}

export function StatusOverview({ tasks, title = "Team Tasks Status" }: StatusOverviewProps) {
  // Filter out cancelled tasks from the overview to focus on real work
  const activeTasks = tasks.filter(t => {
    const s = (t.status || '').toLowerCase();
    return !s.includes('cancel');
  });

  const total = activeTasks.length;

  if (total === 0) {
    return null;
  }

  let done = 0;
  let inProgress = 0;
  let hold = 0;
  let overdue = 0;
  let review = 0;
  let todo = 0;

  activeTasks.forEach(t => {
    const s = (t.status || '').toLowerCase();
    if (s.includes('done') || s.includes('complete')) {
      done++;
    } else if (s.includes('progress') || s.includes('doing')) {
      inProgress++;
    } else if (s.includes('review')) {
      review++;
    } else if (s.includes('hold') || s.includes('wait')) {
      hold++;
    } else if (s.includes('over') || s.includes('late')) {
      overdue++;
    } else {
      todo++;
    }
  });

  const pDone = (done / total) * 100;
  const pInProgress = (inProgress / total) * 100;
  const pReview = (review / total) * 100;
  const pTodo = (todo / total) * 100;
  const pHold = (hold / total) * 100;
  const pOverdue = (overdue / total) * 100;

  const colors = {
    done: '#10b981',       // emerald-500
    inProgress: '#3b82f6', // blue-500
    review: '#a855f7',     // purple-500
    todo: '#94a3b8',       // slate-400
    hold: '#f59e0b',       // amber-500
    overdue: '#ef4444'     // red-500
  };

  let currentPct = 0;
  const gradientParts = [];

  if (pDone > 0) {
    gradientParts.push(`${colors.done} ${currentPct}% ${currentPct + pDone}%`);
    currentPct += pDone;
  }
  if (pInProgress > 0) {
    gradientParts.push(`${colors.inProgress} ${currentPct}% ${currentPct + pInProgress}%`);
    currentPct += pInProgress;
  }
  if (pReview > 0) {
    gradientParts.push(`${colors.review} ${currentPct}% ${currentPct + pReview}%`);
    currentPct += pReview;
  }
  if (pTodo > 0) {
    gradientParts.push(`${colors.todo} ${currentPct}% ${currentPct + pTodo}%`);
    currentPct += pTodo;
  }
  if (pHold > 0) {
    gradientParts.push(`${colors.hold} ${currentPct}% ${currentPct + pHold}%`);
    currentPct += pHold;
  }
  if (pOverdue > 0) {
    gradientParts.push(`${colors.overdue} ${currentPct}% ${currentPct + pOverdue}%`);
    currentPct += pOverdue;
  }

  const conicGradient = gradientParts.length > 0
    ? `conic-gradient(${gradientParts.join(', ')})`
    : 'conic-gradient(#f1f5f9 0% 100%)';

  return (
    <Card className="shadow-sm border-slate-200/60 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <PieChart className="w-5 h-5 text-indigo-600" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col justify-center items-center pb-6 gap-6 pt-2">

        {/* Pie / Donut Chart */}
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center shadow-inner" style={{ background: conicGradient }}>
          {/* Inner white circle for Donut effect */}
          <div className="absolute w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-full shadow-sm flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-slate-800">{total}</span>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Tasks</span>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-3 text-xs w-full">
          <div className="flex flex-col gap-1 items-center bg-emerald-50 px-2 py-1.5 rounded border border-emerald-100">
            <div className="flex items-center gap-1.5 font-medium text-emerald-700">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></div>
              Done
            </div>
            <span className="font-bold text-emerald-700 text-sm">{done}</span>
          </div>
          <div className="flex flex-col gap-1 items-center bg-blue-50 px-2 py-1.5 rounded border border-blue-100">
            <div className="flex items-center gap-1.5 font-medium text-blue-700">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-500"></div>
              In Progress
            </div>
            <span className="font-bold text-blue-700 text-sm">{inProgress}</span>
          </div>
          <div className="flex flex-col gap-1 items-center bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <div className="w-2.5 h-2.5 rounded-sm bg-slate-400"></div>
              To Do
            </div>
            <span className="font-bold text-slate-700 text-sm">{todo}</span>
          </div>
          <div className="flex flex-col gap-1 items-center bg-purple-50 px-2 py-1.5 rounded border border-purple-200">
            <div className="flex items-center gap-1.5 font-medium text-purple-700">
              <div className="w-2.5 h-2.5 rounded-sm bg-purple-500"></div>
              Review
            </div>
            <span className="font-bold text-purple-700 text-sm">{review}</span>
          </div>
          <div className="flex flex-col gap-1 items-center bg-amber-50 px-2 py-1.5 rounded border border-amber-100">
            <div className="flex items-center gap-1.5 font-medium text-amber-700">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-500"></div>
              On Hold
            </div>
            <span className="font-bold text-amber-700 text-sm">{hold}</span>
          </div>
          <div className="flex flex-col gap-1 items-center bg-red-50 px-2 py-1.5 rounded border border-red-200 sm:col-span-2 md:col-span-1 mx-auto sm:mx-0 w-full">
            <div className="flex items-center gap-1.5 font-medium text-red-700">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-500"></div>
              Overdue
            </div>
            <span className="font-bold text-red-700 text-sm">{overdue}</span>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
