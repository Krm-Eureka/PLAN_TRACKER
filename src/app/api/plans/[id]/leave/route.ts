import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(
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

    // 1. Fetch the plan row
    const foundPlan = await prisma.plan.findUnique({ where: { id: plan_id } });
    if (!foundPlan) {
      return NextResponse.json({ status: "error", message: "Plan not found" }, { status: 404 });
    }

    // 2. Check if user is in companions list
    const companionsList = (foundPlan.companions || "").split(",").map((c: string) => c.trim()).filter(Boolean);
    const userIndex = companionsList.findIndex((c: string) => c.toLowerCase() === user_id.toLowerCase());

    // 3. Sync with the linked Task (remove user from assignee_id)
    const task_id = foundPlan.task_id || "";
    if (task_id) {
      // Find if user is in any other plan for this task
      const otherPlans = await prisma.plan.findMany({
        where: {
          task_id: task_id,
          id: { not: plan_id }
        }
      });

      const isUserInOtherPlansForTask = otherPlans.some((r) => {
        const rCompanions = (r.companions || "").split(",").map((c: string) => c.trim().toLowerCase());
        return r.user_id === user_id || rCompanions.includes(user_id.toLowerCase());
      });

      if (!isUserInOtherPlansForTask) {
        try {
          const task = await prisma.task.findUnique({ where: { id: task_id } });
          if (task) {
            const assigneeIds = (task.assignee_id || "").split(",").map((id: string) => id.trim()).filter(Boolean);
            const filteredIds = assigneeIds.filter((id: string) => id.toLowerCase() !== user_id.toLowerCase());

            if (filteredIds.length !== assigneeIds.length) {
              const users = await prisma.user.findMany({
                where: { id: { in: filteredIds } }
              });

              const names = filteredIds.map((id: string) => {
                const found = users.find((u) => u.id === id);
                return found?.name_en || found?.name_th || id;
              });

              await prisma.task.update({
                where: { id: task_id },
                data: {
                  assignee_id: filteredIds.join(", "),
                  assignee_name: names.join(", ")
                }
              });
            }
          }
        } catch (taskErr) {
          console.error("Failed to sync task assignee on leave:", taskErr);
        }
      }
    }

    // 4. If not in companions list, nothing to remove from Plan
    if (userIndex === -1) {
      return NextResponse.json({ status: "success", message: "Already left or not joined" });
    }

    // 5. Remove user from companions and update the Plan row
    companionsList.splice(userIndex, 1);
    const newCompanions = companionsList.join(", ");

    await prisma.plan.update({
      where: { id: plan_id },
      data: { companions: newCompanions }
    });

    return NextResponse.json({ status: "success", message: "Left plan successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error leaving plan:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to leave plan" },
      { status: 500 }
    );
  }
}
