import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateSheetRow, fetchSheetData, getSheetHeaders } from "@/lib/googleSheets";
import { revalidatePath } from "next/cache";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    if (!token) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;
    const userId = resolvedParams.id;
    
    // Security check: Only allow users to update their own profile, unless they are admin
    const currentUserId = (session as { id?: string })?.id;
    const currentUserRole = (session as { role_system?: string })?.role_system?.toLowerCase() || '';
    const isSuperUser = currentUserRole.includes('admin') || currentUserRole.includes('superadmin');
    
    if (currentUserId !== userId && !isSuperUser) {
      return NextResponse.json({ status: "error", message: "Forbidden: You can only edit your own profile" }, { status: 403 });
    }

    const body = await req.json();

    const data = await fetchSheetData(token, "Users!A1:Z");
    const index = data.findIndex((u: any) => u.id === userId);
    
    if (index === -1) {
      return NextResponse.json({ status: "error", message: "User not found" }, { status: 404 });
    }

    const rowIndex = index + 2; // +1 for 0-index, +1 for header
    const existingUser = data[index];
    
    // Permitted fields to update (excluding id and department)
    const { name_th, name_en, nickname, telephone, color } = body;

    // Fetch exact headers to build the row data flexibly, regardless of column order
    const headers = await getSheetHeaders(token, "Users");
    
    // Fallbacks if header doesn't exist
    const updatedValues: Record<string, any> = {
      ...existingUser,
      name_th: name_th !== undefined ? name_th : existingUser.name_th,
      name_en: name_en !== undefined ? name_en : existingUser.name_en,
      nickname: nickname !== undefined ? nickname : existingUser.nickname,
      telephone: telephone !== undefined ? telephone : existingUser.telephone,
      color: color !== undefined ? color : existingUser.color,
    };

    // Construct the row array mapping exactly to the column headers
    const rowData = headers.map(header => {
      // Don't overwrite the original ID and department, even if passed in body
      if (header === 'id') return existingUser.id;
      if (header === 'department') return existingUser.department || "";
      return updatedValues[header] !== undefined ? updatedValues[header] : "";
    });

    // If 'color' isn't in headers, we append it if we have space, but it's safer 
    // to just let it drop if the admin hasn't added the 'color' column yet.
    // We will append it at the end if it's missing from headers but provided.
    if (!headers.includes('color') && color) {
      rowData.push(color);
    }

    const lastColLetter = String.fromCharCode(65 + Math.max(headers.length, rowData.length) - 1);
    await updateSheetRow(token, `Users!A${rowIndex}:${lastColLetter}${rowIndex}`, rowData);
    
    revalidatePath("/(dashboard)");
    revalidatePath("/projects");
    revalidatePath("/tasks");

    return NextResponse.json({ status: "success", message: "Profile updated successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("API error updating user:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to update profile" }, { status: 500 });
  }
}
