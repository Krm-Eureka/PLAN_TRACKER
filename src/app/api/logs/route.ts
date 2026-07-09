import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchSheetData } from "@/lib/googleSheets";
import { unstable_cache } from "next/cache";

const getCachedLogsRaw = unstable_cache(
  async (token: string) => await fetchSheetData(token, "Logs!A:Z"),
  ["logs_raw"],
  { revalidate: 30 }
);

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;

    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const data = await getCachedLogsRaw(token);
    return NextResponse.json({ status: "success", data });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("GET /api/logs error:", err);
    return NextResponse.json({ status: "error", message: err.message || "Failed to fetch logs" }, { status: 500 });
  }
}
