import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/lib/auth";
import { AccountNav } from "@/components/storefront/account/account-nav";
import { Section } from "@/components/storefront/layout/section";

/**
 * STORY-033. The authenticated account area's shell (this route group is
 * separate from `(public)` — login/register/forgot/reset-password — so
 * this guard never wraps them, which would otherwise redirect-loop).
 *
 * This is the "secure" check per Next's own auth guidance
 * (node_modules/next/dist/docs/.../authentication.md): proxy.ts already
 * does an "optimistic" redirect with the correct callbackUrl before this
 * ever runs, but a shared layout doesn't re-render on sibling client-side
 * navigation, so it can't be the only check — see this story's future
 * account pages, each of which fetches its own data via auth() too.
 */
export default async function AccountDashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/account/login?callbackUrl=/account");

  return (
    <Section containerSize="wide">
      <AccountNav />
      <div className="mt-6">{children}</div>
    </Section>
  );
}
