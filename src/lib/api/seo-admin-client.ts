/** STORY-051a. Fetch wrappers for /api/admin/seo/[entityType]/[entityId]. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type SeoEntityTypeValue = "Product" | "Recipe" | "BlogPost";

export interface SeoMetaAdmin {
  id: string;
  entityType: SeoEntityTypeValue;
  entityId: string;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogImageUrl: string | null;
  ogImageAlt: string | null;
  ogImageWidth: number | null;
  ogImageHeight: number | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  focusKeyword: string | null;
  jsonLdOverride: unknown;
}

export type SeoMetaFormInput = Omit<SeoMetaAdmin, "id" | "entityType" | "entityId">;

export async function fetchSeoMeta(entityType: SeoEntityTypeValue, entityId: string): Promise<SeoMetaAdmin | null> {
  const response = await fetch(`/api/admin/seo/${entityType}/${entityId}`);
  if (!response.ok) throw new Error(`Failed to load SEO fields (${response.status})`);
  return response.json();
}

export async function updateSeoMetaAdmin(entityType: SeoEntityTypeValue, entityId: string, input: SeoMetaFormInput): Promise<SeoMetaAdmin> {
  const response = await fetch(`/api/admin/seo/${entityType}/${entityId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save the SEO fields");
  return response.json();
}
