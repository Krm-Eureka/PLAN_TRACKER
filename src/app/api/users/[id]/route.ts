// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

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

    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      return NextResponse.json({ status: "error", message: "User not found" }, { status: 404 });
    }

    // Permitted fields to update (excluding id, emp_id, and department)
    const { name_th, name_en, nickname, telephone, color } = body;

    await prisma.user.update({
      where: { id: userId },
      data: {
        name_th: name_th !== undefined ? name_th : existingUser.name_th,
        name_en: name_en !== undefined ? name_en : existingUser.name_en,
        nickname: nickname !== undefined ? nickname : existingUser.nickname,
        telephone: telephone !== undefined ? telephone : existingUser.telephone,
        color: color !== undefined ? color : existingUser.color,
      }
    });
    
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
