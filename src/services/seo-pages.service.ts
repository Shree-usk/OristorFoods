import type { SeoEntityType } from "@/generated/prisma/client";
import { computeSeoHealth, type SeoHealthCheck } from "@/lib/seo-health";
import * as seoRepository from "@/repositories/seo.repository";
import { listPostsForAdmin } from "@/services/blog-admin.service";
import { requirePermission } from "@/services/permission.service";
import { listProductsForAdmin } from "@/services/product-admin.service";
import { listRecipesForAdmin } from "@/services/recipe-admin.service";
import { updateSeoMeta } from "@/services/seo.service";

/**
 * STORY-051d. The central, cross-entity-type SEO audit list — reuses
 * Product/Recipe/BlogPost's own admin list services (each already
 * defaults to every status, not just Published, when no status filter is
 * passed) rather than adding parallel "list everything" repo functions.
 * A large pageSize stands in for "give me everything," the same approach
 * sitemap.service.ts already took for this catalog's size.
 */
const BULK_LIST_SIZE = 10_000;

export interface SeoPageRow {
  entityType: SeoEntityType;
  entityId: string;
  title: string;
  slug: string;
  url: string;
  status: string;
  updatedAt: Date;
  metaTitle: string | null;
  metaDescription: string | null;
  health: SeoHealthCheck[];
  isDuplicateTitle: boolean;
}

interface UnscoredRow {
  entityType: SeoEntityType;
  entityId: string;
  title: string;
  slug: string;
  url: string;
  status: string;
  updatedAt: Date;
}

export async function listSeoPagesForAdmin(adminUserId: string): Promise<SeoPageRow[]> {
  // Gates the central-list feature itself on the SEO module, in addition
  // to the per-content-type View checks each list call below makes on its
  // own — belt and suspenders, but harmless: every role in this project
  // already gets View everywhere outside its own home modules.
  await requirePermission(adminUserId, "SEO", "View");

  const [products, recipes, posts] = await Promise.all([
    listProductsForAdmin(adminUserId, {}, 1, BULK_LIST_SIZE),
    listRecipesForAdmin(adminUserId, {}, 1, BULK_LIST_SIZE),
    listPostsForAdmin(adminUserId, {}, 1, BULK_LIST_SIZE),
  ]);

  const [productSeo, recipeSeo, postSeo] = await Promise.all([
    seoRepository.listSeoMetaForEntityIds("Product", products.items.map((item) => item.id)),
    seoRepository.listSeoMetaForEntityIds("Recipe", recipes.items.map((item) => item.id)),
    seoRepository.listSeoMetaForEntityIds("BlogPost", posts.items.map((item) => item.id)),
  ]);

  const seoByKey = new Map<string, (typeof productSeo)[number]>();
  for (const row of [...productSeo, ...recipeSeo, ...postSeo]) seoByKey.set(`${row.entityType}:${row.entityId}`, row);

  const unscored: UnscoredRow[] = [
    ...products.items.map((item) => ({ entityType: "Product" as const, entityId: item.id, title: item.name, slug: item.slug, url: `/products/${item.slug}`, status: item.status, updatedAt: item.updatedAt })),
    ...recipes.items.map((item) => ({ entityType: "Recipe" as const, entityId: item.id, title: item.title, slug: item.slug, url: `/recipes/${item.slug}`, status: item.status, updatedAt: item.updatedAt })),
    ...posts.items.map((item) => ({ entityType: "BlogPost" as const, entityId: item.id, title: item.title, slug: item.slug, url: `/blog/${item.slug}`, status: item.status, updatedAt: item.updatedAt })),
  ];

  // Same metaTitle-falls-back-to-the-entity's-own-title convention the
  // storefront pages' own generateMetadata already uses — duplicates are
  // flagged against what search engines would actually see, not the raw
  // metaTitle column alone (which is usually unset).
  const effectiveTitleOf = (row: UnscoredRow, metaTitle: string | null) => (metaTitle || row.title).trim().toLowerCase();

  const titleCounts = new Map<string, number>();
  for (const row of unscored) {
    const seo = seoByKey.get(`${row.entityType}:${row.entityId}`);
    const key = effectiveTitleOf(row, seo?.metaTitle ?? null);
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }

  return unscored.map((row) => {
    const seo = seoByKey.get(`${row.entityType}:${row.entityId}`);
    const metaTitle = seo?.metaTitle ?? null;
    const metaDescription = seo?.metaDescription ?? null;
    return {
      ...row,
      metaTitle,
      metaDescription,
      health: computeSeoHealth({
        metaTitle,
        metaDescription,
        canonicalUrl: seo?.canonicalUrl ?? null,
        ogImageUrl: seo?.ogImageUrl ?? null,
        ogImageAlt: seo?.ogImageAlt ?? null,
        ogImageWidth: seo?.ogImageWidth ?? null,
        ogImageHeight: seo?.ogImageHeight ?? null,
      }),
      isDuplicateTitle: (titleCounts.get(effectiveTitleOf(row, metaTitle)) ?? 0) > 1,
    };
  });
}

export interface BulkApplyTitleTemplateRef {
  entityType: SeoEntityType;
  entityId: string;
  title: string;
}

export interface BulkApplyTitleTemplateResult {
  succeeded: { entityType: SeoEntityType; entityId: string }[];
  failed: { entityType: SeoEntityType; entityId: string; reason: string }[];
}

/**
 * A `{title}` placeholder only, expanded with each entity's own display
 * title — not a rich template engine, which this story's AC doesn't ask
 * for. Delegates to seo.service.ts's updateSeoMeta per ref (not a direct
 * repository call), the same way product-admin.service.ts's bulkChangeStatus
 * delegates to its own single-row changeProductStatus — reuses its
 * permission check and audit log per row rather than duplicating them.
 */
export async function bulkApplyTitleTemplate(adminUserId: string, refs: BulkApplyTitleTemplateRef[], template: string): Promise<BulkApplyTitleTemplateResult> {
  const result: BulkApplyTitleTemplateResult = { succeeded: [], failed: [] };

  for (const ref of refs) {
    try {
      const existing = await seoRepository.findSeoMeta(ref.entityType, ref.entityId);
      await updateSeoMeta(adminUserId, ref.entityType, ref.entityId, {
        metaTitle: template.replaceAll("{title}", ref.title),
        metaDescription: existing?.metaDescription ?? null,
        canonicalUrl: existing?.canonicalUrl ?? null,
        ogImageUrl: existing?.ogImageUrl ?? null,
        ogImageAlt: existing?.ogImageAlt ?? null,
        ogImageWidth: existing?.ogImageWidth ?? null,
        ogImageHeight: existing?.ogImageHeight ?? null,
        robotsIndex: existing?.robotsIndex ?? true,
        robotsFollow: existing?.robotsFollow ?? true,
        focusKeyword: existing?.focusKeyword ?? null,
      });
      result.succeeded.push({ entityType: ref.entityType, entityId: ref.entityId });
    } catch (error) {
      result.failed.push({ entityType: ref.entityType, entityId: ref.entityId, reason: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  return result;
}
