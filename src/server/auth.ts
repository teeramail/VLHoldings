import NextAuth, { type DefaultSession, type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";

import { env } from "~/env";
import { db } from "~/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "~/server/db/schema";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      email: string;
    } & DefaultSession["user"];
  }
}

const providers = [] as NextAuthConfig["providers"];

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  );
}

console.log("Initializing NextAuth with providers count:", providers.length);

export const authConfig = {
  trustHost: true,
  debug: true,
  logger: {
    error(code, ...message) {
      console.error("[NEXTAUTH ERROR]", code, JSON.stringify(message, null, 2));
    },
    warn(code, ...message) {
      console.warn("[NEXTAUTH WARN]", code, message);
    },
    debug(code, ...message) {
      console.log("[NEXTAUTH DEBUG]", code, message);
    },
  },
  secret: env.AUTH_SECRET,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.email = (token.email as string) ?? session.user.email;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig);

/**
 * Return the Google user email from the NextAuth session, if any.
 * Returns lowercased email or null.
 */
export async function getSessionEmail(): Promise<string | null> {
  try {
    const session = await auth();
    const email = session?.user?.email;
    return email ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}
