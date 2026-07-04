import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Clock, AlertCircle, ListTodo } from "lucide-react"

const stats = [
  { name: 'Total Projects', stat: '12', icon: ListTodo, color: 'text-blue-600', bg: 'bg-blue-100' },
  { name: 'Tasks In Progress', stat: '24', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
  { name: 'Overdue Tasks', stat: '3', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
  { name: 'Completed (This Week)', stat: '18', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
]

export function StatCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((item) => (
        <Card key={item.name} className="overflow-hidden border-slate-200/60 shadow-sm transition-all hover:shadow-md hover:border-slate-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500">
              {item.name}
            </CardTitle>
            <div className={`p-2 rounded-lg ${item.bg}`}>
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{item.stat}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
