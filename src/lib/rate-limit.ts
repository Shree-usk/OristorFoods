/**
 * STORY-033. Fixed-window, in-memory rate limiting — no Redis/queue
 * dependency exists in this stack yet. Deliberately process-local: fine
 * for a single-instance deployment, but resets on every restart and
 * doesn't coordinate across instances. Revisit with a shared store (e.g.
 * Redis) before running more than one app instance behind a load balancer
 * — see docs/architecture-decisions.md.
 */

interface RateLimitConfig {
  max: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Returns false once `key` has made `max` calls within the current `windowMs` window. */
export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return true;
  }

  if (bucket.count >= config.max) return false;

  bucket.count += 1;
  return true;
}

/** Clears a key's window — called after a successful attempt so a legitimate user isn't penalised by earlier failures. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
