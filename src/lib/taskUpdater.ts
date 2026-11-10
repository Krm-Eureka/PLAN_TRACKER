import { prisma } from "@/lib/prisma";
import { calculateProjectProgress } from "@/utils/status";
import { isCancelStatus, isDoneStatus, isHoldStatus } from "@/constants/status";
import type { TaskData } from "@/interfaces";

export async function updateProjectAndParentTasks(projectId: string) {
  if (!projectId) return;

  try {
    const projectTasks = await prisma.task.findMany({
      where: { project_id: projectId }
    });
    
    if (projectTasks.length === 0) return;

    // 1. Auto-update Parent Tasks
    const getProgress = (taskId: string): number => {
      const children = projectTasks.filter(t => t.parent_task_id === taskId && !(t.status || '').toLowerCase().includes('cancel'));
      if (children.length === 0) {
        const t = projectTasks.find(x => x.id === taskId);
        if (!t) return 0;
        const st = (t.status || '').toLowerCase();
        if (st.includes('cancel') || st.includes('to do')) return 0;
        if (st.includes('done') || st.includes('complete')) return 100;
        return t.percent_complete && !isNaN(Number(t.percent_complete)) ? Math.min(100, Math.max(0, Number(t.percent_complete))) : 0;
      }
      const sum = children.reduce((acc, child) => acc + getProgress(child.id), 0);
      return Math.round(sum / children.length);
    };

    const parentIds = new Set(projectTasks.map(t => t.parent_task_id).filter(Boolean));
    
    for (const pId of parentIds) {
      if (!pId) continue;
      const pProgress = getProgress(pId);
      let newStatus = 'To Do';
      if (pProgress === 100) newStatus = 'Done';
      else if (pProgress > 0) newStatus = 'In Progress';
      
      const pTask = projectTasks.find(t => t.id === pId);
      if (pTask && pTask.status !== newStatus) {
        await prisma.task.update({
          where: { id: pId },
          data: {
            status: newStatus,
            update_date: newStatus === 'Done' ? new Date().toISOString().split("T")[0] : pTask.update_date
          }
        });
        // Update in memory for project progress calculation
        pTask.status = newStatus;
      }
    }

    // 2. Auto-update Project Progress
    // ใช้สูตรเดียวกับหน้าจอ (calculateProjectProgress) เพื่อให้ค่าที่เก็บใน DB ตรงกับที่ผู้ใช้เห็น
    // เดิมนับแค่ "จำนวน task ที่ Done" ทำให้ task In Progress 25% แสดงบนจอ 25% แต่ใน DB/รายงานเป็น 0%
    const projectProgress = calculateProjectProgress(projectTasks as unknown as TaskData[]);

    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { id: projectId },
          { project_code: projectId }
        ]
      }
    });

    if (project) {
      const currentStatus = project.status || '';
      let newStatus = currentStatus;

      // On Hold / Cancelled ตั้งโดยคน ไม่เปลี่ยนให้อัตโนมัติ
      if (!isHoldStatus(currentStatus) && !isCancelStatus(currentStatus)) {
        if (projectProgress === 100) {
          newStatus = 'Done';
        } else if (projectProgress > 0) {
          // เริ่มทำงานแล้ว: Planning/To Do/Done → In Progress
          newStatus = 'In Progress';
        } else if (isDoneStatus(currentStatus)) {
          newStatus = 'In Progress';
        }
      }

      await prisma.project.update({
        where: { id: project.id },
        data: {
          progress: String(projectProgress),
          status: newStatus
        }
      });
    }
  } catch (error) {
    console.error("Failed to update project and parent tasks:", error);
  }
}
