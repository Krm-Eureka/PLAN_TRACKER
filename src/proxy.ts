import {
  STATIC_SECURITY_HEADERS,
  buildCspHeader,
} from "@/lib/securityHeaders";
import { IS_TEST_MODE } from "@/lib/testMode";
import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

function applySecurityHeaders(req: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const isHttps =
    req.nextUrl.protocol === "https:" || forwardedProto === "https";

  const csp = buildCspHeader({
    nonce,
    isDev,
    upgradeInsecureRequests: isHttps,
  });

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  for (const { key, value } of STATIC_SECURITY_HEADERS) {
    response.headers.set(key, value);
  }
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

const authMiddleware = withAuth(
  (req) => applySecurityHeaders(req),
  {
    pages: {
      signIn: "/auth/signin",
    },
  }
);

export default function middleware(req: NextRequest, event: any) {
  if (req.nextUrl.pathname.startsWith("/auth/signin")) {
    return applySecurityHeaders(req);
  }
  if (IS_TEST_MODE) {
    return applySecurityHeaders(req);
  }
  return (authMiddleware as any)(req, event);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth API routes)
     * - api/cron (Vercel Cron — ป้องกันด้วย CRON_SECRET ใน route เอง)
     * - api/webhooks/line (LINE OA Webhook — ป้องกันด้วย X-Line-Signature ใน route เอง)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|api/cron|api/webhooks/line|_next/static|_next/image|favicon.ico).*)",
  ],
};

