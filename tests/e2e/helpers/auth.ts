import type { Page } from "@playwright/test";
import { encode } from "next-auth/jwt";

/** Signs the browser in as `userId` by setting an Auth.js session cookie. */
export async function signInAs(page: Page, userId: string): Promise<void> {
  const token = await encode({
    token: { sub: userId },
    secret: process.env.AUTH_SECRET!,
    salt: "authjs.session-token",
  });
  await page.context().addCookies([{ name: "authjs.session-token", value: token, domain: "localhost", path: "/" }]);
}
