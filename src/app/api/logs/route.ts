// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const data = await prisma.log.findMany({
      orderBy: { created_at: 'desc' },
      take: 100 // Limit to recent 100 logs
    });
    
    return NextResponse.json({ status: "success", data });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("GET /api/logs error:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to fetch logs" }, { status: 500 });
  }
}
