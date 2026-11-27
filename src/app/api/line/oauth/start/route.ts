import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/permissions";
import {
  LINE_OAUTH_COOKIE_NAME,
  LINE_OAUTH_TTL_SECONDS,
  buildLineAuthorizeUrl,
  generateOAuthState,
  generatePkcePair,
  isLineLoginConfigured,
  signLineOAuthCookie,
} from "@/lib/lineOAuth";

export async function GET(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx?.id) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  if (!isLineLoginConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?lineError=not_configured", req.url)
    );
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID!.trim();
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/line/oauth/callback`;
  const state = generateOAuthState();
  const { codeVerifier, codeChallenge } = generatePkcePair();

  const signedCookie = signLineOAuthCookie({
    state,
    codeVerifier,
    userId: ctx.id,
    exp: Date.now() + LINE_OAUTH_TTL_SECONDS * 1000,
  });

  const authorizeUrl = buildLineAuthorizeUrl({
    channelId,
    redirectUri,
    state,
    codeChallenge,
  });

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(LINE_OAUTH_COOKIE_NAME, signedCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/api/line/oauth",
    maxAge: LINE_OAUTH_TTL_SECONDS,
  });
  return res;
}
