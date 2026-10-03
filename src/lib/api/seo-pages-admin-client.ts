import type { SeoHealthCheck } from "@/lib/seo-health";
import type { SeoEntityTypeValue } from "@/lib/api/seo-admin-client";

/** STORY-051d. Fetch wrappers for /api/admin/seo/pages. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface SeoPageRow {
  entityType: SeoEntityTypeValue;
  entityId: string;
  title: string;
  slug: string;
  url: string;
  status: string;
  updatedAt: string;
  metaTitle: string | null;
  metaDescription: string | null;
  health: SeoHealthCheck[];
  isDuplicateTitle: boolean;
}

export interface BulkApplyTitleTemplateResult {
  succeeded: { entityType: SeoEntityTypeValue; entityId: string }[];
  failed: { entityType: SeoEntityTypeValue; entityId: string; reason: string }[];
}

export async function fetchSeoPages(): Promise<SeoPageRow[]> {
  const response = await fetch("/api/admin/seo/pages");
  if (!response.ok) throw new Error(`Failed to load the SEO pages list (${response.status})`);
  return response.json();
}

export async function bulkApplyTitleTemplateAdmin(refs: { entityType: SeoEntityTypeValue; entityId: string; title: string }[], template: string): Promise<BulkApplyTitleTemplateResult> {
  const response = await fetch("/api/admin/seo/pages/bulk-apply-title", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refs, template }),
  });
  await assertOkWithServerMessage(response, "Failed to apply the title template");
  return response.json();
}
