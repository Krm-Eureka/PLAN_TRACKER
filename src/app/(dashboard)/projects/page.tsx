import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { fetchProjects, fetchTeamWorkload } from "@/services/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FolderKanban, Calendar, Clock, AlertCircle } from "lucide-react"

import Link from "next/link"
import { AddProjectButton } from "@/components/projects/AddProjectButton"
import { getStatusColor } from "@/utils/status"

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;
  let projects: any[] = [];
  let users: any[] = [];
  let errorMsg = null;

  try {
    const [fetchedProjects, fetchedUsers] = await Promise.all([
      fetchProjects(token),
      fetchTeamWorkload(token).catch(() => [])
    ]);
    projects = fetchedProjects;
    users = fetchedUsers;
  } catch (error: any) {
    console.error("Failed to fetch projects:", error);
    errorMsg = error.message;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FolderKanban className="w-8 h-8 text-indigo-600" />
            Projects Portfolio
          </h1>
          <p className="text-slate-500 mt-1">Manage and track all ongoing IT projects.</p>
        </div>
        <AddProjectButton users={users} />
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-start gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Failed to load projects</h3>
            <p className="text-sm mt-1">{errorMsg}</p>
          </div>
        </div>
      )}

      {!errorMsg && projects.length === 0 && (
        <Card className="border-dashed border-2 bg-slate-50/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <FolderKanban className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No Projects Found</h3>
            <p className="text-slate-500 mt-1 max-w-sm">
              We couldn't find any projects in your Google Sheet, or the data format doesn't match.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {projects.map((project, index) => {
          // Use project_code as ID, or fallback to index if missing
          const projectId = project.project_code || `project-${index}`;
          return (
          <Link href={`/projects/${encodeURIComponent(projectId)}`} key={projectId}>
            <Card 
              className="group overflow-hidden border-slate-200/60 shadow-sm hover:shadow-xl hover:border-indigo-200/60 transition-all duration-300 bg-white h-full"
            >
              <CardHeader className="pb-4 relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="font-mono text-xs text-indigo-600 bg-indigo-50 border-indigo-100">
                    {project.project_code || 'N/A'}
                  </Badge>
                  <Badge className={`px-2.5 py-0.5 font-medium transition-colors ${getStatusColor(project.status)}`}>
                    {project.status || 'Unknown'}
                  </Badge>
                </div>
                <CardTitle className="text-xl leading-tight group-hover:text-indigo-600 transition-colors">
                  {project.project_name || 'Untitled Project'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Dynamically render a few interesting fields if they exist */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {project.start_date && (
                      <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400">Start</p>
                          <p className="font-medium">{project.start_date}</p>
                        </div>
                      </div>
                    )}
                    {project.end_date && (
                      <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400">Target</p>
                          <p className="font-medium">{project.end_date}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Additional custom fields mapped dynamically */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-xs text-slate-500 space-y-1.5 line-clamp-3">
                      {Object.entries(project)
                        .filter(([k]) => !['project_code', 'project_name', 'status', 'start_date', 'end_date'].includes(k.toLowerCase()) && project[k])
                        .slice(0, 3)
                        .map(([key, value]) => (
                          <div key={key} className="flex gap-2">
                            <span className="font-medium text-slate-700 capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className="truncate">{String(value)}</span>
                          </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )})}
      </div>
    </div>
  )
}
