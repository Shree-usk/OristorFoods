import type { Page } from "@playwright/test";
import { encode } from "next-auth/jwt";

import { prisma } from "@/lib/db";

/**
 * Signs the browser in as `userId` by setting an Auth.js session cookie.
 *
 * STORY-033: src/lib/auth.ts's jwt callback rejects any token whose `pwv`
 * (password version) claim doesn't match the user's current
 * `passwordChangedAt` — so a hand-crafted token needs that claim too, or
 * every test using this helper would look "invalidated" on the very next
 * request.
 */
export async function signInAs(page: Page, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordChangedAt: true } });
  const pwv = user?.passwordChangedAt ? user.passwordChangedAt.getTime() : 0;

  const token = await encode({
    token: { sub: userId, pwv },
    secret: process.env.AUTH_SECRET!,
    salt: "authjs.session-token",
  });
  await page.context().addCookies([{ name: "authjs.session-token", value: token, domain: "localhost", path: "/" }]);
}
