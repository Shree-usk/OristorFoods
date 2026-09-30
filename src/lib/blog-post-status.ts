import type { BlogPostStatus } from "@/generated/prisma/client";

/**
 * "Scheduled" vs. "Live" is a derived UI label, never a stored value —
 * `BlogPostStatus.Scheduled` is never written (see
 * docs/architecture-decisions.md's STORY-044 entry). Publishing a post
 * always writes `status: "Published"`, whether `publishedAt` is in the
 * past, now, or the future; the storefront's own `publishedWhere` already
 * gates visibility on `publishedAt <= now`, so a future date is already
 * correctly invisible with zero cron needed.
 *
 * A pure function with no server dependencies so both
 * blog-admin.service.ts (server) and the admin list view (client) can
 * import it without pulling Prisma into a client bundle — the
 * `BlogPostStatus` import above is type-only and erased at build time.
 * The parameter still accepts the real enum's `"Scheduled"` member (even
 * though this codebase never writes it) purely so callers passing a raw
 * `BlogPost.status` value typecheck without an unsafe cast.
 */
export type BlogPostEffectiveStatus = "Draft" | "Scheduled" | "Live" | "Archived";

export function deriveEffectiveStatus(status: BlogPostStatus, publishedAt: Date | string | null): BlogPostEffectiveStatus {
  if (status !== "Published") return status;
  const date = publishedAt ? new Date(publishedAt) : null;
  return date && date > new Date() ? "Scheduled" : "Live";
}
