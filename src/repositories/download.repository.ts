import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const withCategory = { category: true } satisfies Prisma.DownloadResourceInclude;

export type DownloadResourceWithCategory = Prisma.DownloadResourceGetPayload<{ include: typeof withCategory }>;

export function findPublishedResourceBySlug(slug: string): Promise<DownloadResourceWithCategory | null> {
  return prisma.downloadResource.findFirst({
    where: { slug, status: "Published" },
    include: withCategory,
  });
}

export function listCategories() {
  return prisma.downloadCategory.findMany({ orderBy: { sortOrder: "asc" } });
}

export interface PublishedResourceQuery {
  categorySlug?: string;
  skip: number;
  take: number;
}

export async function listPublishedResources(
  query: PublishedResourceQuery,
): Promise<{ items: DownloadResourceWithCategory[]; total: number }> {
  const where: Prisma.DownloadResourceWhereInput = {
    status: "Published",
    ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.downloadResource.findMany({
      where,
      include: withCategory,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: query.skip,
      take: query.take,
    }),
    prisma.downloadResource.count({ where }),
  ]);
  return { items, total };
}

/**
 * Raw UPDATE rather than `prisma.downloadResource.update`, mirroring
 * recipe.repository.ts's incrementRecipeViewCount exactly: so `@updatedAt`
 * isn't touched by a download (a download is not a content edit).
 */
export async function incrementDownloadCount(resourceId: string): Promise<void> {
  await prisma.$executeRaw`UPDATE "DownloadResource" SET "downloadCount" = "downloadCount" + 1 WHERE "id" = ${resourceId}`;
}
