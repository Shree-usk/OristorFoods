/**
 * STORY-051c. The canonical *public* site URL — intentionally NOT
 * NEXTAUTH_URL/AUTH_SECRET-adjacent config (that's the auth callback
 * base and must track whatever environment is actually running,
 * localhost in dev). This should always resolve to the real production
 * domain regardless of environment, same reasoning src/app/layout.tsx's
 * own `metadataBase` already uses. Extracted here since the same
 * `process.env.NEXT_PUBLIC_SITE_URL ?? "https://oristor.com"` fallback
 * was copy-pasted in several places before this story (two of them as
 * their own per-file `SITE_URL` constant) — sitemap.ts, robots.ts, and
 * the Organization JSON-LD all need it too, so this is the one place to
 * change it going forward instead of a sixth copy.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oristor.com";
