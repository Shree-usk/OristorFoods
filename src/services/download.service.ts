import * as downloadRepository from "@/repositories/download.repository";
import { DownloadAuthRequiredError, DownloadResourceNotFoundError } from "@/services/download.errors";
import type { DownloadCategorySummary, DownloadListQuery, DownloadListResult, DownloadResourceCard } from "@/types/download";

function toCard(row: downloadRepository.DownloadResourceWithCategory): DownloadResourceCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnailUrl,
    fileType: row.fileType,
    fileSizeBytes: row.fileSizeBytes,
    requiresAuth: row.requiresAuth,
    category: { id: row.category.id, name: row.category.name, slug: row.category.slug },
  };
}

export async function listCategories(): Promise<DownloadCategorySummary[]> {
  const rows = await downloadRepository.listCategories();
  return rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug }));
}

export async function listResources(query: DownloadListQuery): Promise<DownloadListResult> {
  const { items, total } = await downloadRepository.listPublishedResources({
    categorySlug: query.category,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { items: items.map(toCard), total, page: query.page, pageSize: query.pageSize };
}

/**
 * Called by the file-serving route before it ever touches the filesystem
 * (Task 5). Throws DownloadResourceNotFoundError for a missing OR
 * unpublished slug (the caller can't distinguish "never existed" from
 * "exists but Draft/Archived" from the response — same information-hiding
 * choice recipe-review.service.ts's requirePublishedRecipe already makes)
 * and DownloadAuthRequiredError when the resource requires a session the
 * caller doesn't have.
 */
export async function resolveFileAccess(
  slug: string,
  isAuthenticated: boolean,
): Promise<downloadRepository.DownloadResourceWithCategory> {
  const resource = await downloadRepository.findPublishedResourceBySlug(slug);
  if (!resource) throw new DownloadResourceNotFoundError();
  if (resource.requiresAuth && !isAuthenticated) throw new DownloadAuthRequiredError();
  return resource;
}

export function recordDownload(resourceId: string): Promise<void> {
  return downloadRepository.incrementDownloadCount(resourceId);
}
