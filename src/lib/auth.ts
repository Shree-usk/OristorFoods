import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/db";
import { AccountSuspendedError } from "@/services/auth.errors";
import { getPasswordVersion, verifyCredentials } from "@/services/auth.service";
import { credentialsSchema } from "@/validation/auth.schema";

/** STORY-048. The signin-page-visible counterpart of AccountSuspendedError — @auth/core requires a CredentialsSignin subclass to show a distinct message instead of the generic "CredentialsSignin" error. */
class AccountSuspendedSignInError extends CredentialsSignin {
  code = "account_suspended";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    // Credentials provider requires JWT sessions — the adapter above still
    // persists Users/Accounts for when OAuth providers are added later.
    strategy: "jwt",
  },
  pages: {
    signIn: "/account/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (rawCredentials, request) => {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        try {
          return await verifyCredentials(parsed.data.email, parsed.data.password, request);
        } catch (error) {
          if (error instanceof AccountSuspendedError) throw new AccountSuspendedSignInError();
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    // STORY-033: `pwv` ("password version") is the sign-in-time
    // passwordChangedAt stamp. On every subsequent token refresh (no
    // `user` present — that only happens at sign-in) it's re-checked
    // against the DB; a mismatch means the password was reset since this
    // token was issued, so the token is rejected outright. Throwing here
    // is deliberate: @auth/core's session action catches it and clears
    // the session cookie, which is how a stale JWT actually gets
    // invalidated under a stateless (Credentials-only) session strategy.
    jwt: async ({ token, user }) => {
      if (user) {
        token.pwv = user.passwordVersion ?? 0;
        return token;
      }
      if (typeof token.sub === "string") {
        const current = await getPasswordVersion(token.sub);
        if (current !== token.pwv) throw new Error("SessionInvalidated");
      }
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: { ...session.user, id: token.sub },
    }),
  },
});
