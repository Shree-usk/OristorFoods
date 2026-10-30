import Link from "next/link";

import { getResolvedAnnouncementBar } from "@/services/system-settings.service";

/**
 * Thin strip above the sticky header — not itself sticky, scrolls away
 * with the page. Server Component: renders nothing until an admin has
 * both enabled it and set a message (see
 * system-settings.service.ts::getResolvedAnnouncementBar), so there's
 * nothing to hide/collapse on the client.
 */
export async function AnnouncementBar() {
  const announcement = await getResolvedAnnouncementBar();
  if (!announcement) return null;

  const { message, linkLabel, linkHref } = announcement;

  return (
    <div className="bg-charcoal px-4 py-2 text-center">
      {linkHref ? (
        <Link
          href={linkHref}
          className="inline-flex flex-wrap items-center justify-center gap-2 text-caption font-medium tracking-wide text-cream uppercase hover:text-cream/80"
        >
          <span>{message}</span>
          {linkLabel && <span className="underline underline-offset-2">{linkLabel}</span>}
        </Link>
      ) : (
        <p className="text-caption font-medium tracking-wide text-cream uppercase">{message}</p>
      )}
    </div>
  );
}
