import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { AccountLockedError } from "@/services/admin-auth.errors";
import { getAdminPasswordVersion, verifyAdminCredentials } from "@/services/admin-auth.service";
import { adminCredentialsSchema } from "@/validation/admin-auth.schema";

/**
 * Auth.js's documented mechanism for surfacing a specific authorize()
 * failure reason through the redirect/JSON response's `code` param
 * (`CredentialsSignin`'s own doc comment: "code is configurable"). Used
 * only for lockout — a plain wrong password still returns null (no
 * enumeration), matching admin-auth.service.ts's own no-enumeration design.
 */
class AccountLockedSignin extends CredentialsSignin {
  code = "account_locked";
}

/**
 * STORY-038. A fully separate NextAuth v5 instance from src/lib/auth.ts —
 * no shared adapter (Credentials + JWT sessions need none; unlike the
 * customer instance, no OAuth provider is planned here, so there's nothing
 * to persist Accounts for), an explicit distinct session-cookie name (the
 * customer instance relies on Auth.js's default `authjs.session-token` —
 * an admin instance without an override would silently collide with it),
 * and an explicit distinct `secret` (ADMIN_AUTH_SECRET, not AUTH_SECRET) so
 * the two systems are cryptographically separate, not just cookie-name
 * separate. See docs/architecture-decisions.md.
 */

const isProduction = process.env.NODE_ENV === "production";
const cookiePrefix = isProduction ? "__Secure-" : "";

export const { handlers, auth: adminAuth, signIn: adminSignIn, signOut: adminSignOut } = NextAuth({
  // Auth.js defaults basePath to /api/auth (next-auth/lib/env.js) unless
  // told otherwise — without this, the admin instance silently assumes
  // it's mounted at the customer instance's path and fails to parse any
  // action ("Cannot parse action at /api/admin/auth/csrf").
  basePath: "/api/admin/auth",
  session: {
    strategy: "jwt",
  },
  secret: process.env.ADMIN_AUTH_SECRET,
  pages: {
    signIn: "/admin/login",
  },
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}admin-authjs.session-token`,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProduction },
    },
    callbackUrl: {
      name: `${cookiePrefix}admin-authjs.callback-url`,
      options: { sameSite: "lax", path: "/", secure: isProduction },
    },
    csrfToken: {
      // __Host- (stricter than __Secure-) matches Auth.js's own default behavior for the CSRF cookie.
      name: `${isProduction ? "__Host-" : ""}admin-authjs.csrf-token`,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProduction },
    },
  },
  providers: [
    Credentials({
      name: "Admin Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (rawCredentials) => {
        const parsed = adminCredentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        try {
          return await verifyAdminCredentials(parsed.data.email, parsed.data.password);
        } catch (error) {
          // Re-thrown as AccountLockedSignin so its `code` survives into
          // the response the login form reads — a raw thrown error would
          // otherwise just become a generic CallbackRouteError. Any other
          // unexpected error still surfaces as a plain denial rather than
          // crashing the auth flow.
          if (error instanceof AccountLockedError) throw new AccountLockedSignin();
          console.error("[admin-auth] unexpected error during authorize", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    // Mirrors src/lib/auth.ts's jwt callback exactly, with its own claim
    // name (`aupv`, not `pwv`) so the two token shapes can never be
    // confused even if a secret were ever shared by mistake.
    jwt: async ({ token, user }) => {
      if (user) {
        token.aupv = user.passwordVersion ?? 0;
        return token;
      }
      if (typeof token.sub === "string") {
        const current = await getAdminPasswordVersion(token.sub);
        if (current !== token.aupv) throw new Error("AdminSessionInvalidated");
      }
      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: { ...session.user, id: token.sub },
    }),
  },
});
