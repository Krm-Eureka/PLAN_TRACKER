import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchTeamWorkload } from "@/services/api"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function TeamWorkload() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;
  let users: any[] = [];
  
  try {
    users = await fetchTeamWorkload(token);
  } catch (error: any) {
    console.error("TeamWorkload render error:", error.message);
    // Continue rendering with empty array so user can access Sign Out button
  }

  return (
    <Card className="shadow-sm border-slate-200/60">
      <CardHeader>
        <CardTitle>Team Workload</CardTitle>
        <CardDescription>Current capacity of IT team members.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map((person) => {
            // Dummy logic for capacity: assume max capacity is 20 tasks
            const capacity = Math.min((person.active_tasks / 20) * 100, 100);
            const initials = person.name_en ? person.name_en.split(' ').map((n: string) => n[0]).join('').substring(0, 2) : 'IT';

            return (
              <div key={person.emp_id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-xs text-slate-600">
                    {initials}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900 text-sm">{person.name_en}</span>
                    <span className="text-xs text-slate-500">{person.position} ({person.department})</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 w-1/3">
                  <span className="text-xs font-medium text-slate-600">{person.active_tasks || 0} tasks active</span>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${capacity > 75 ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${capacity}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  )
}
