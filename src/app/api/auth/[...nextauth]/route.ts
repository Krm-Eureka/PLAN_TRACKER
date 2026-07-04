import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

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
    async signIn({ user, account, profile }) {
      // Allow only users from specific domain (Internal Only as per requirement)
      const allowedDomain = process.env.COMPANY_DOMAIN || "yourcompany.com";
      
      if (user.email && !user.email.endsWith(`@${allowedDomain}`)) {
        // Return false to deny sign-in, or return a URL to redirect to an error page
        return false;
      }
      return true;
    },
    async jwt({ token, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client, like an access_token from a provider.
      if (session.user) {
        (session.user as any).role = "Developer"; // Mock role
        (session as any).accessToken = token.accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin', // Custom signin page can be added later
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
