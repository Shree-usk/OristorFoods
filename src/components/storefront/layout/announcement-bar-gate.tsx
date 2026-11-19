"use client";

import { usePathname } from "next/navigation";

/**
 * Hides the (sitewide, single-message) top promo strip on /export and its
 * subpages. The strip's content is a domestic retail promo (e.g. a local-
 * currency free-delivery threshold) aimed at everyday shoppers — it isn't
 * relevant to /export's overseas distributor audience, which already has
 * its own dedicated hero/CTAs immediately below the header. Every other
 * route is unaffected; same `pathname.startsWith` route-matching
 * convention as NavLinks' active-link highlighting.
 */
export function AnnouncementBarGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/export")) return null;
  return <>{children}</>;
}
