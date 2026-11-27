import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { v7 as uuidv7 } from "uuid";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/permissions";
import {
  LINE_OAUTH_COOKIE_NAME,
  isLineLoginConfigured,
  verifyLineOAuthCookie,
} from "@/lib/lineOAuth";

function redirectWithClear(url: URL, req: NextRequest): NextResponse {
  const res = NextResponse.redirect(url);
  res.cookies.set(LINE_OAUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/api/line/oauth",
    maxAge: 0,
  });
  return res;
}

export async function GET(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx?.id) {
    return redirectWithClear(new URL("/auth/signin", req.url), req);
  }

  const settingsUrl = new URL("/settings", req.url);
  if (!isLineLoginConfigured()) {
    settingsUrl.searchParams.set("lineError", "not_configured");
    return redirectWithClear(settingsUrl, req);
  }

  const errorParam = req.nextUrl.searchParams.get("error");
  if (errorParam) {
    settingsUrl.searchParams.set(
      "lineError",
      errorParam === "access_denied" ? "cancelled" : "oauth_failed"
    );
    return redirectWithClear(settingsUrl, req);
  }

  const code = req.nextUrl.searchParams.get("code") || "";
  const state = req.nextUrl.searchParams.get("state") || "";
  const rawCookie = req.cookies.get(LINE_OAUTH_COOKIE_NAME)?.value;
  const oauthCtx = verifyLineOAuthCookie(rawCookie);

  if (
    !code ||
    !state ||
    !oauthCtx ||
    oauthCtx.state !== state ||
    oauthCtx.userId !== ctx.id
  ) {
    settingsUrl.searchParams.set("lineError", "invalid_state");
    return redirectWithClear(settingsUrl, req);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: ctx.id },
    select: { id: true },
  });
  if (!dbUser) {
    settingsUrl.searchParams.set("lineError", "user_not_found");
    return redirectWithClear(settingsUrl, req);
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/line/oauth/callback`;
    const tokenRes = await axios.post(
      "https://api.line.me/oauth2/v2.1/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINE_LOGIN_CHANNEL_ID!.trim(),
        client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET!.trim(),
        code_verifier: oauthCtx.codeVerifier,
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10_000,
        validateStatus: () => true,
      }
    );

    if (tokenRes.status < 200 || tokenRes.status >= 300) {
      console.error("LINE token exchange failed:", tokenRes.status);
      settingsUrl.searchParams.set("lineError", "oauth_failed");
      return redirectWithClear(settingsUrl, req);
    }

    const tokenData = (tokenRes.data || {}) as { access_token?: string };
    if (!tokenData.access_token) {
      settingsUrl.searchParams.set("lineError", "oauth_failed");
      return redirectWithClear(settingsUrl, req);
    }

    const profileRes = await axios.get("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      timeout: 10_000,
      validateStatus: () => true,
    });
    if (profileRes.status < 200 || profileRes.status >= 300) {
      console.error("LINE profile fetch failed:", profileRes.status);
      settingsUrl.searchParams.set("lineError", "oauth_failed");
      return redirectWithClear(settingsUrl, req);
    }

    const profile = (profileRes.data || {}) as {
      userId?: string;
      displayName?: string;
    };
    if (!profile.userId) {
      settingsUrl.searchParams.set("lineError", "oauth_failed");
      return redirectWithClear(settingsUrl, req);
    }

    await prisma.$transaction([
      prisma.lineAccount.deleteMany({
        where: {
          OR: [{ line_user_id: profile.userId }, { user_id: dbUser.id }],
        },
      }),
      prisma.lineAccount.create({
        data: {
          id: uuidv7(),
          user_id: dbUser.id,
          line_user_id: profile.userId,
          display_name: profile.displayName || null,
          linked_at: new Date(),
        },
      }),
      prisma.lineLinkToken.updateMany({
        where: { user_id: dbUser.id, used_at: null },
        data: { used_at: new Date() },
      }),
    ]);

    settingsUrl.searchParams.set("lineLinked", "1");
    return redirectWithClear(settingsUrl, req);
  } catch (error) {
    console.error("GET /api/line/oauth/callback error:", error);
    settingsUrl.searchParams.set("lineError", "oauth_failed");
    return redirectWithClear(settingsUrl, req);
  }
}
