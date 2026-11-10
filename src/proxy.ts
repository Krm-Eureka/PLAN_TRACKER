import { IS_TEST_MODE } from "@/lib/testMode";
import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

const authMiddleware = withAuth({
  pages: {
    signIn: "/auth/signin",
  },
});

export default function middleware(req: NextRequest, event: any) {
  if (IS_TEST_MODE) {
    return NextResponse.next();
  }
  return (authMiddleware as any)(req, event);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - auth/signin (your custom signin page)
     * - api/auth (NextAuth API routes)
     * - api/cron (Vercel Cron — ป้องกันด้วย CRON_SECRET ใน route เอง)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!auth/signin|api/auth|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};

