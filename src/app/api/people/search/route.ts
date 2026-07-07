import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    
    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    if (!query) {
      return NextResponse.json({ status: "success", data: [] });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });

    const people = google.people({ version: "v1", auth });

    // Use searchDirectoryPeople to search within the organization
    const res = await people.people.searchDirectoryPeople({
      readMask: "names,emailAddresses,photos",
      sources: ["DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE"],
      query: query,
    });

    const results = (res.data.people || []).map((person: any) => ({
      resourceName: person.resourceName,
      name: person.names?.[0]?.displayName || "Unknown",
      email: person.emailAddresses?.[0]?.value || "",
      photoUrl: person.photos?.[0]?.default ? "" : (person.photos?.[0]?.url || ""),
    }));

    return NextResponse.json({ status: "success", data: results });
  } catch (error: any) {
    console.error("Failed to search people:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to search people" },
      { status: 500 }
    );
  }
}
