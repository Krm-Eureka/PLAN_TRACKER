import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData, updateSheetRow, deleteSheetRows, clearSheetCache } from "@/lib/googleSheets";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    
    if (!token) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const rows = await fetchSheetData(token, "Plans!A:Z");
    if (!rows || rows.length === 0) {
      return NextResponse.json({ status: "success", message: "No plans to merge" });
    }

    // Group plans by signature: same project + date + location + task + time
    const groups = new Map<string, any[]>();
    for (let i = 0; i < rows.length; i++) {
      const plan = rows[i];
      const rowIndex = i + 2; // +1 for 0-index, +1 for header
      const signature = [
        plan.project_id || 'none',
        plan.location || 'none',
        plan.start_date || 'none',
        plan.duration_days || '1',
        plan.plan_detail || 'none'
      ].join('_');
      
      if (!groups.has(signature)) {
        groups.set(signature, []);
      }
      groups.get(signature)!.push({ ...plan, rowIndex });
    }

    const updateRanges: string[] = [];
    const updateValues: any[][][] = [];
    const deleteIndices: number[] = [];

    groups.forEach((planGroup) => {
      if (planGroup.length > 1) {
        // Primary plan is the first row
        const primary = planGroup[0];
        
        // Collect ALL user IDs (owner + companions from all duplicates)
        const allCompanions = new Set<string>();

        // Start with companions from the primary
        if (primary.companions || primary.col_10) {
          (primary.companions || primary.col_10).split(',').forEach((c: string) => {
            if (c.trim()) allCompanions.add(c.trim());
          });
        }

        // Add owners and companions from duplicate rows
        for (let i = 1; i < planGroup.length; i++) {
          const dup = planGroup[i];
          if (dup.user_id && dup.user_id !== primary.user_id) {
            allCompanions.add(dup.user_id.trim());
          }
          if (dup.companions || dup.col_10) {
            (dup.companions || dup.col_10).split(',').forEach((c: string) => {
              if (c.trim()) allCompanions.add(c.trim());
            });
          }
          deleteIndices.push(dup.rowIndex);
        }

        const newCompanionsStr = Array.from(allCompanions).join(", ");
        
        updateRanges.push(`Plans!A${primary.rowIndex}:K${primary.rowIndex}`);
        updateValues.push([[
          primary.id,
          primary.user_id,
          primary.project_id || "",
          primary.start_date || "",
          primary.location || "",
          primary.duration_days || "1",
          primary.plan_detail || "",
          primary.task_id || "",
          primary.start_time || "",
          primary.end_time || "",
          newCompanionsStr
        ]]);
      }
    });

    if (updateRanges.length === 0 && deleteIndices.length === 0) {
      return NextResponse.json({ status: "success", message: "No duplicates found to merge" });
    }

    // Process updates one by one
    for (let i = 0; i < updateRanges.length; i++) {
      await updateSheetRow(token, updateRanges[i], updateValues[i][0]);
    }

    // Delete duplicate rows (descending order to preserve indices)
    if (deleteIndices.length > 0) {
      await deleteSheetRows(token, "Plans", deleteIndices);
    }

    // Clear cache so next fetch returns fresh merged data
    clearSheetCache();

    return NextResponse.json({ 
      status: "success", 
      message: `Merged ${updateRanges.length} plan groups, deleted ${deleteIndices.length} duplicate rows` 
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Migration error:", err);
    return NextResponse.json({ status: "error", message: err.message }, { status: 500 });
  }
}
