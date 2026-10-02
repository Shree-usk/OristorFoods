import * as redirectRepository from "@/repositories/redirect.repository";

/**
 * STORY-051b. Module-scope TTL cache so src/proxy.ts (which runs on every
 * storefront request) doesn't hit the DB per page view — the first
 * in-memory Map/TTL cache pattern in this codebase. In-flight-promise
 * de-duplication prevents a thundering herd of concurrent requests all
 * triggering their own DB fetch on a cold/expired cache.
 *
 * **The TTL is the only freshness mechanism — confirmed empirically, not
 * assumed.** Next.js compiles proxy.ts (middleware) into a separate
 * module bundle from route handlers, even within the same Node.js
 * process; an eager `invalidateRedirectCache()` call from
 * redirect.service.ts (a route handler) nulls *that bundle's own copy*
 * of this module's state, never the copy proxy.ts reads from. A first
 * attempt assumed same-process module state was shared and relied on
 * eager invalidation alone with a 30s TTL as a fallback — an e2e test
 * creating a redirect and immediately visiting it caught this: the
 * redirect never resolved until the TTL (then 30s) actually expired,
 * regardless of the invalidation call. The calls are kept (harmless,
 * and correct for any future same-bundle reader) but must never be
 * assumed to fix proxy.ts's freshness — only this TTL does. 10s: short
 * enough that an admin testing a just-created redirect doesn't perceive
 * it as broken, long enough to still meaningfully cut DB load under
 * real traffic.
 */

const TTL_MS = 10_000;

export interface CachedRedirect {
  destinationPath: string;
  statusCode: number;
}

let redirects: Map<string, CachedRedirect> | null = null;
let fetchedAt = 0;
let inFlight: Promise<Map<string, CachedRedirect>> | null = null;

async function fetchRedirects(): Promise<Map<string, CachedRedirect>> {
  const rows = await redirectRepository.listActiveRedirects();
  return new Map(rows.map((row) => [row.sourcePath, { destinationPath: row.destinationPath, statusCode: row.statusCode }]));
}

export async function getActiveRedirectsCached(): Promise<Map<string, CachedRedirect>> {
  const isFresh = redirects !== null && Date.now() - fetchedAt < TTL_MS;
  if (isFresh) return redirects!;

  if (!inFlight) {
    inFlight = fetchRedirects()
      .then((result) => {
        redirects = result;
        fetchedAt = Date.now();
        return result;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/**
 * Called by redirect.service.ts after any create/update/delete/bulk-import.
 * Does NOT reach src/proxy.ts's own copy of this module's state (see the
 * TTL comment above — they're separate bundles) — kept only in case a
 * future same-bundle (route-handler-side) reader needs the fresh list;
 * never rely on this for proxy.ts's freshness, only the TTL does that.
 */
export function invalidateRedirectCache(): void {
  redirects = null;
  fetchedAt = 0;
}

/** Test-only — lets a unit test reset state between cases without module-cache tricks. */
export function __resetRedirectCacheForTests(): void {
  redirects = null;
  fetchedAt = 0;
  inFlight = null;
}
