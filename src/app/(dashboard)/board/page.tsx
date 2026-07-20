import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { KanbanSquare } from "lucide-react";

export default function BoardPage() {
  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-hidden">
      <div className="flex flex-col gap-1 shrink-0 px-2 pt-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <KanbanSquare className="w-8 h-8 text-emerald-600" />
          Task Board
        </h1>
        <p className="text-slate-500">Drag and drop tasks to update their status instantly.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <KanbanBoard />
      </div>
    </div>
  );
}
