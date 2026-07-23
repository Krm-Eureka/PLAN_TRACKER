// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/permissions";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { v7 as uuidv7 } from "uuid";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionContext();
    const user_id = session?.id;
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

    // 2. Guard: already joined or is the owner
    const companionsList = (foundPlan.companions || "").split(",").map((c: string) => c.trim()).filter(Boolean);
    if (foundPlan.user_id === user_id || companionsList.map((c: string) => c.toLowerCase()).includes(user_id.toLowerCase())) {
      return NextResponse.json({ status: "success", message: "Already joined" });
    }

    // 3. Add user to companions and update the Plan row
    companionsList.push(user_id);
    const newCompanions = companionsList.join(", ");

    await prisma.plan.update({
      where: { id: plan_id },
      data: { companions: newCompanions }
    });

    // 4. Sync with the linked Task (add user to assignee_id)
    const task_id = foundPlan.task_id || "";
    if (task_id) {
      try {
        const task = await prisma.task.findUnique({ where: { id: task_id } });
        if (task) {
          const assigneeIds = (task.assignee_id || "").split(",").map((id: string) => id.trim()).filter(Boolean);

          if (!assigneeIds.some((id: string) => id.toLowerCase() === user_id.toLowerCase())) {
            assigneeIds.push(user_id);

            const users = await prisma.user.findMany({
              where: { id: { in: assigneeIds } }
            });

            const names = assigneeIds.map((id: string) => {
              const found = users.find((u) => u.id === id);
              return found?.name_en || found?.name_th || id;
            });

            await prisma.task.update({
              where: { id: task_id },
              data: {
                assignee_id: assigneeIds.join(", "),
                assignee_name: names.join(", ")
              }
            });
          }
        }
      } catch (taskErr) {
        console.error("Failed to sync task assignee on join:", taskErr);
      }
    }

    // 5. Notify the plan owner
    if (foundPlan.user_id) {
      const sessionUser = (session as { user?: { name?: string } })?.user?.name || "Someone";
      const notifId = uuidv7();
      await prisma.notification.create({
        data: {
          id: notifId,
          user: { connect: { id: foundPlan.user_id } },
          title: "New Plan Joiner",
          message: `${sessionUser} has joined your plan: ${foundPlan.location}`,
          link: `/calendar`,
          is_read: false
        }
      });
    }

    return NextResponse.json({ status: "success", message: "Joined plan successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error joining plan:", err);
    return NextResponse.json(
      { status: "error", message: err.message || "Failed to join plan" },
      { status: 500 }
    );
  }
}
