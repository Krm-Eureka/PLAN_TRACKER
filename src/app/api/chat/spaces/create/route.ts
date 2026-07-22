// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { google } from "googleapis";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const token = (session as { accessToken?: string })?.accessToken;
    
    if (!token) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const { targetUser } = await req.json();
    if (!targetUser) {
      return NextResponse.json({ status: "error", message: "Missing targetUser" }, { status: 400 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    const chat = google.chat({ version: "v1", auth });

    // Ensure the targetUser is in the format "users/{id}"
    // The People API returns "people/{id}", so we need to replace "people/" with "users/"
    const chatUserResource = targetUser.replace('people/', 'users/');

    const requestBody = {
      space: {
        spaceType: "DIRECT_MESSAGE",
        singleUserBotDm: false,
      },
      memberships: [
        {
          member: {
            name: chatUserResource,
            type: "HUMAN",
          },
        },
      ],
    };

    const res = await chat.spaces.setup({
      requestBody,
    });

    return NextResponse.json({ status: "success", data: res.data });
  } catch (error: any) {
    console.error("Failed to create chat space:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Failed to create chat space" },
      { status: 500 }
    );
  }
}
