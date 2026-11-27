import { safeErrorMessage } from "@/lib/apiError";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/permissions";
import { updateProjectIssueStatus } from "@/lib/issueService";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getSessionContext();
    if (!ctx) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await req.json();
    const status = String(body.status || "").trim();

    if (!status) {
      return NextResponse.json(
        { status: "error", message: "status is required" },
        { status: 400 }
      );
    }

    const result = await updateProjectIssueStatus({
      ctx,
      issueIdOrCode: id,
      newStatus: status,
    });

    if (!result.ok) {
      return NextResponse.json(
        { status: "error", message: result.message },
        { status: result.status }
      );
    }

    revalidatePath("/issues");
    revalidatePath(`/projects/${result.issue.project_id}`);

    return NextResponse.json({ status: "success", data: result.issue });
  } catch (error: unknown) {
    console.error("PATCH /api/issues/[id] error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: safeErrorMessage(error, "Failed to update issue"),
      },
      { status: 500 }
    );
  }
}
