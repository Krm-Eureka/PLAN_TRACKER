import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { v7 as uuidv7 } from "uuid";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = (session as { id?: string })?.id;
    if (!user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const plan_id = resolvedParams.id;

    const foundPlan = await prisma.plan.findUnique({ where: { id: plan_id } });
    if (!foundPlan) {
      return NextResponse.json({ status: "error", message: "Plan not found" }, { status: 404 });
    }

    if (foundPlan.user_id !== user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized to delete this plan" }, { status: 403 });
    }

    await prisma.plan.delete({ where: { id: plan_id } });

    // Sync Task Assignees if the plan had a task
    if (foundPlan.task_id) {
      try {
        const task = await prisma.task.findUnique({ where: { id: foundPlan.task_id } });
        if (task) {
          let assigneeIds = (task.assignee_id || "").split(",").map((id: string) => id.trim()).filter(Boolean);
          const participants = [foundPlan.user_id, ...(foundPlan.companions || "").split(",").map((s: string) => s.trim())].filter(Boolean);

          let hasChanges = false;
          // Check if participants are in any OTHER plan for this task
          const otherPlans = await prisma.plan.findMany({
            where: {
              task_id: foundPlan.task_id,
              id: { not: plan_id }
            }
          });

          for (const id of participants) {
            const inOtherPlans = otherPlans.some((r) => {
              const rComps = (r.companions || "").split(",").map((c: string) => c.trim().toLowerCase());
              return r.user_id === id || rComps.includes(id.toLowerCase());
            });

            if (!inOtherPlans) {
              const originalLength = assigneeIds.length;
              assigneeIds = assigneeIds.filter((a: string) => a.toLowerCase() !== id.toLowerCase());
              if (assigneeIds.length !== originalLength) hasChanges = true;
            }
          }

          if (hasChanges) {
            const users = await prisma.user.findMany({
              where: { id: { in: assigneeIds } }
            });
            const names = assigneeIds.map((id: string) => {
              const u = users.find((u) => u.id === id);
              return u?.name_en || u?.name_th || id;
            });

            await prisma.task.update({
              where: { id: foundPlan.task_id },
              data: {
                assignee_id: assigneeIds.join(", "),
                assignee_name: names.join(", ")
              }
            });
          }
        }
      } catch (e) {
        console.error("Failed to sync task assignees on plan delete:", e);
      }
    }

    return NextResponse.json({ status: "success", message: "Plan deleted successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error deleting plan:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to delete plan" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const user_id = (session as { id?: string })?.id;
    if (!user_id) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const plan_id = resolvedParams.id;
    const body = await req.json();

    const foundPlan = await prisma.plan.findUnique({ where: { id: plan_id } });
    if (!foundPlan) {
      return NextResponse.json({ status: "error", message: "Plan not found" }, { status: 404 });
    }

    const companionsList = (foundPlan.companions || "").split(",").map((c: string) => c.trim().toLowerCase());
    const isOwner = foundPlan.user_id === user_id;
    const isCompanion = companionsList.includes(user_id.toLowerCase());
    
    if (!isOwner && !isCompanion) {
      return NextResponse.json({ status: "error", message: "Unauthorized to update this plan" }, { status: 403 });
    }

    const updateData: any = {};
    if (body.project_id !== undefined) updateData.project = body.project_id ? { connect: { id: body.project_id } } : { disconnect: true };
    if (body.start_date !== undefined) updateData.start_date = body.start_date;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.duration_days !== undefined) updateData.duration_days = body.duration_days;
    if (body.plan_detail !== undefined) updateData.plan_detail = body.plan_detail;
    if (body.task_id !== undefined) updateData.task = body.task_id ? { connect: { id: body.task_id } } : { disconnect: true };
    if (body.start_time !== undefined) updateData.start_time = body.start_time;
    if (body.end_time !== undefined) updateData.end_time = body.end_time;
    if (body.companions !== undefined) updateData.companions = body.companions;

    await prisma.plan.update({
      where: { id: plan_id },
      data: updateData
    });

    // Send notifications to new companions
    if (body.companions !== undefined) {
      const oldCompanions = (foundPlan.companions || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      const newCompanions = body.companions.split(",").map((s: string) => s.trim()).filter(Boolean);
      const addedCompanions = newCompanions.filter((id: string) => !oldCompanions.includes(id) && id !== user_id);
      
      if (addedCompanions.length > 0) {
        const sessionUser = (session as { user?: { name?: string } })?.user?.name || "Someone";
        const notificationsToCreate = addedCompanions.map((cid: string) => ({
          id: uuidv7(),
          user_id: cid,
          title: "Added to a Plan",
          message: `${sessionUser} has added you to their plan: ${body.location || foundPlan.location}`,
          link: "/calendar",
          is_read: false
        }));
        
        await prisma.notification.createMany({
          data: notificationsToCreate
        });
      }
    }

    // Sync Task Assignees if companions or task changed
    const currentTaskId = body.task_id !== undefined ? body.task_id : (foundPlan.task_id || "");
    if (currentTaskId && body.companions !== undefined) {
      try {
        const oldCompanionsRaw = (foundPlan.companions || "").split(",").map((s: string) => s.trim()).filter(Boolean);
        const newCompanionsRaw = body.companions.split(",").map((s: string) => s.trim()).filter(Boolean);
        
        const added = newCompanionsRaw.filter((id: string) => !oldCompanionsRaw.includes(id));
        const removed = oldCompanionsRaw.filter((id: string) => !newCompanionsRaw.includes(id));

        if (added.length > 0 || removed.length > 0) {
          const task = await prisma.task.findUnique({ where: { id: currentTaskId } });
          if (task) {
            let assigneeIds = (task.assignee_id || "").split(",").map((id: string) => id.trim()).filter(Boolean);

            // Add new companions
            added.forEach((id: string) => {
              if (!assigneeIds.map((a: string) => a.toLowerCase()).includes(id.toLowerCase())) {
                assigneeIds.push(id);
              }
            });

            // Remove companions
            const allPlans = await prisma.plan.findMany({ where: { task_id: currentTaskId } });
            removed.forEach((id: string) => {
              const inOtherPlans = allPlans.some((r) => {
                if (r.id === plan_id) return false;
                const rComps = (r.companions || "").split(",").map((c: string) => c.trim().toLowerCase());
                return r.user_id === id || rComps.includes(id.toLowerCase());
              });
              if (!inOtherPlans) {
                assigneeIds = assigneeIds.filter((a: string) => a.toLowerCase() !== id.toLowerCase());
              }
            });

            const users = await prisma.user.findMany({
              where: { id: { in: assigneeIds } }
            });
            const names = assigneeIds.map((id: string) => {
              const u = users.find((u) => u.id === id);
              return u?.name_en || u?.name_th || id;
            });

            await prisma.task.update({
              where: { id: currentTaskId },
              data: {
                assignee_id: assigneeIds.join(", "),
                assignee_name: names.join(", ")
              }
            });
          }
        }
      } catch (e) {
        console.error("Failed to sync task assignees on plan update:", e);
      }
    }

    return NextResponse.json({ status: "success", message: "Plan updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error updating plan:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to update plan" }, { status: 500 });
  }
}
