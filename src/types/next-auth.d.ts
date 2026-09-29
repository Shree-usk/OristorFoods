import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  /** STORY-033. Carries the sign-in-time password version into the jwt callback. */
  interface User {
    passwordVersion?: number;
  }
}

declare module "next-auth/jwt" {
  /** STORY-033. Compared against the DB's current version to invalidate sessions after a password reset. */
  interface JWT {
    pwv?: number;
  }
}
