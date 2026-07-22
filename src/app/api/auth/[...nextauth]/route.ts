// @ts-nocheck
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

async function refreshAccessToken(token: { refreshToken?: unknown;[key: string]: unknown }) {
  try {
    const url = "https://oauth2.googleapis.com/token";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });

    const refreshedTokens = await response.json();
    if (!response.ok) throw refreshedTokens;

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    };
  } catch (error) {
    console.error("RefreshAccessTokenError", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

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
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/chat.spaces.readonly",
            "https://www.googleapis.com/auth/chat.spaces.create",
            "https://www.googleapis.com/auth/chat.memberships.readonly",
            "https://www.googleapis.com/auth/chat.messages",
            "https://www.googleapis.com/auth/chat.messages.create",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/directory.readonly"
          ].join(" ")
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
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000;
      }

      if (account || !token.emp_id || !token.name_th) {
        try {
          // Use Prisma to find the user by email
          const me = await prisma.user.findUnique({
            where: { email: token.email?.toLowerCase() || "" }
          });
          
          if (me) {
            token.id = me.id;
            token.department = me.department_id || "";
            token.division = me.division || "";
            token.role_system = me.role_system || "member";
            token.name_en = me.name_en || "";
            token.name_th = me.name_th || "";
            token.nickname = me.nickname || "";
            token.emp_id = me.emp_id || "";
            token.position = me.position || "";
          }
        } catch (e) {
          console.error("Failed to fetch user profile from DB:", e);
        }
      }

      // Return token if initial sign-in
      if (account) {
        return token;
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.accessTokenExpires as number) - 60000) {
        return token;
      }

      // Access token has expired, try to update it
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (session.user) {
        (session as any).accessToken = token.accessToken;
        (session as any).error = token.error;
        (session as any).id = token.id || "";
        (session as any).department = token.department || "";
        (session as any).division = token.division || "";
        (session as any).role_system = token.role_system || "member";
        (session as any).name_en = token.name_en || "";
        (session as any).name_th = token.name_th || "";
        (session as any).nickname = token.nickname || "";
        (session as any).emp_id = token.emp_id || "";
        (session as any).position = token.position || "";
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  jwt: {
    maxAge: 8 * 60 * 60, // 8 hours
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

