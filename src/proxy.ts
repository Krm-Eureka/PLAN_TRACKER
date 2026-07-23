import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

const authMiddleware = withAuth({
  pages: {
    signIn: "/auth/signin",
  },
});

export default function middleware(req: NextRequest, event: any) {
  if (process.env.PLAYWRIGHT_TEST === "1" || process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === "1") {
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
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!auth/signin|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};

