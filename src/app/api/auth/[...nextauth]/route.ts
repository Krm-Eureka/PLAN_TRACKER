import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { fetchSheetData } from "@/lib/googleSheets";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile https://www.googleapis.com/auth/spreadsheets"
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const allowedDomain = process.env.COMPANY_DOMAIN || "yourcompany.com";
      if (user.email && !user.email.endsWith(`@${allowedDomain}`)) {
        return false;
      }
      return true;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;

        // Pull user's department and role from Users sheet on first login
        try {
          const users = await fetchSheetData(account.access_token as string, "Users!A:Z");
          const me = users.find((u: any) =>
            (u.email || "").toLowerCase() === (token.email || "").toLowerCase()
          );
          if (me) {
            token.department = me.department || "";
            token.division   = me.division || "";
            token.role_system = me.role_system || "member";
          }
        } catch (e) {
          console.error("Failed to fetch user profile from sheet:", e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session as any).accessToken  = token.accessToken;
        (session as any).department   = token.department  || "";
        (session as any).division     = token.division    || "";
        (session as any).role_system  = token.role_system || "member";
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
