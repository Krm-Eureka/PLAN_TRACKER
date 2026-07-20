import dynamic from "next/dynamic"
const InteractiveCalendar = dynamic(() => import("@/components/calendar/InteractiveCalendar").then(mod => mod.InteractiveCalendar), { loading: () => <div className="h-[600px] w-full animate-pulse bg-slate-100 rounded-xl"></div> })
import { Calendar as CalendarIcon } from "lucide-react"

export default function CalendarPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-8 h-8 text-emerald-600" />
            Team Calendar & Plans
          </h1>
          <p className="text-slate-500 mt-1">View and submit daily working plans.</p>
        </div>
      </div>

      <InteractiveCalendar />
    </div>
  )
}
