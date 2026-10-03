import { SITE_URL } from "@/lib/site-url";
import * as menuRepository from "@/repositories/menu.repository";
import type { MenuItemRow } from "@/repositories/menu.repository";
import { requirePermission } from "@/services/permission.service";
import { buildSitemapEntries } from "@/services/sitemap.service";

/**
 * STORY-052. Fixed top-level routes that are real but deliberately
 * excluded from the sitemap (account-gated pages, legal pages, etc. —
 * see sitemap.service.ts's own static-page list, which is scoped to SEO
 * indexing, not "every real route"). A nav item can legitimately link to
 * any of these, so the link checker needs its own, broader list.
 */
const STATIC_ROUTES = [
  "/",
  "/products",
  "/recipes",
  "/recipes/cooking-tips",
  "/food-academy",
  "/export",
  "/blog",
  "/about",
  "/contact",
  "/account",
  "/account/wishlist",
  "/account/rewards",
  "/account/referrals",
  "/cart",
  "/search",
  "/legal/privacy",
  "/legal/terms",
  "/sustainability",
  "/downloads",
];

export interface LinkCheckResult {
  itemId: string;
  label: string;
  ok: boolean;
  reason?: string;
}

/** Strips query string and hash before comparing — nav links commonly point at a base route with filters (e.g. "/products?collection=best-sellers"), not a discrete sitemap entry. */
function basePath(path: string): string {
  return path.split("?")[0]!.split("#")[0]!;
}

export async function checkInternalPath(path: string): Promise<boolean> {
  const base = basePath(path);
  if (STATIC_ROUTES.includes(base)) return true;

  const entries = await buildSitemapEntries();
  return entries.some((entry) => basePath(entry.url.replace(SITE_URL, "")) === base);
}

export type ExternalUrlChecker = (url: string) => Promise<boolean>;

/** The real checker — injectable so tests never make a live network call. */
export const defaultCheckExternalUrl: ExternalUrlChecker = async (url) => {
  try {
    const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return response.ok;
  } catch {
    return false;
  }
};

async function checkItem(item: MenuItemRow, checkExternalUrl: ExternalUrlChecker): Promise<LinkCheckResult> {
  if (item.linkType === "Internal" && item.internalPath) {
    const ok = await checkInternalPath(item.internalPath);
    return { itemId: item.id, label: item.label, ok, reason: ok ? undefined : `"${item.internalPath}" doesn't match a real page.` };
  }
  if (item.linkType === "External" && item.externalUrl) {
    const ok = await checkExternalUrl(item.externalUrl);
    return { itemId: item.id, label: item.label, ok, reason: ok ? undefined : `"${item.externalUrl}" could not be reached.` };
  }
  return { itemId: item.id, label: item.label, ok: true };
}

/** Checks every item in a menu (flat — children are fetched by the caller's own menu read, which already includes every row regardless of nesting) in parallel. */
export async function checkMenuLinks(adminUserId: string, menuId: string, checkExternalUrl: ExternalUrlChecker = defaultCheckExternalUrl): Promise<LinkCheckResult[]> {
  await requirePermission(adminUserId, "Navigation", "View");

  const menu = await menuRepository.findMenuById(menuId);
  if (!menu) return [];

  const results = await Promise.allSettled(menu.items.map((item) => checkItem(item, checkExternalUrl)));
  return results.map((result, index) => (result.status === "fulfilled" ? result.value : { itemId: menu.items[index]!.id, label: menu.items[index]!.label, ok: false, reason: "Check failed unexpectedly." }));
}
