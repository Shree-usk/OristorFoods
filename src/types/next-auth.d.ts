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
  /**
   * STORY-033/038. Module augmentation is global, not per-NextAuth-instance
   * — `pwv` (customer) and `aupv` (admin, STORY-038) both live here even
   * though only one is ever populated on a given real token, since the two
   * systems use different secrets/cookies and can never read each other's
   * tokens anyway.
   */
  interface JWT {
    pwv?: number;
    aupv?: number;
  }
}
