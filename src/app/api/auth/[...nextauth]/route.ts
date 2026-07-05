import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { fetchSheetData } from "@/lib/googleSheets";

async function refreshAccessToken(token: { refreshToken?: unknown; [key: string]: unknown }) {
  try {
    const url = "https://oauth2.googleapis.com/token";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
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
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000;

        try {
          const users = await fetchSheetData(account.access_token as string, "Users!A:Z");
          const me = users.find((u: { email?: string; department?: string; division?: string; role_system?: string; id?: string }) =>
            (u.email || "").toLowerCase() === (token.email || "").toLowerCase()
          );
          if (me) {
            token.id = me.id || "";
            token.department = me.department || "";
            token.division   = me.division || "";
            token.role_system = me.role_system || "member";
          }
        } catch (e) {
          console.error("Failed to fetch user profile from sheet:", e);
        }
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
        (session as { accessToken?: unknown, error?: unknown, department?: unknown, division?: unknown, role_system?: unknown, id?: unknown }).accessToken  = token.accessToken;
        (session as { error?: unknown }).error        = token.error;
        (session as { id?: unknown }).id              = token.id || "";
        (session as { department?: unknown }).department   = token.department  || "";
        (session as { division?: unknown }).division     = token.division    || "";
        (session as { role_system?: unknown }).role_system  = token.role_system || "member";
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

