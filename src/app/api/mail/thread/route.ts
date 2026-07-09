import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { searchEmailThreads, getUserSignature } from "@/lib/googleMail";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    
    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const query = url.searchParams.get("q");

    if (!query) {
      return NextResponse.json({ status: "error", message: "Missing query parameter 'q'" }, { status: 400 });
    }

    const threads = await searchEmailThreads(token, query, 5);
    const signature = await getUserSignature(token);

    return NextResponse.json({ 
      status: "success", 
      data: {
        threads,
        signature
      }
    });

  } catch (error: any) {
    console.error("API Error (/api/mail/thread):", error);
    return NextResponse.json({ status: "error", message: error.message || "Internal Server Error" }, { status: 500 });
  }
}
