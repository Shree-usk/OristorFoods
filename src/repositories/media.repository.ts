import type { MediaAssetType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { escapeLikePattern } from "@/lib/escape-like-pattern";

/** STORY-041. The only place MediaAsset/MediaAssetTag are queried/mutated. */

const withTags = { tags: true, folder: true } satisfies Prisma.MediaAssetInclude;

export type MediaAssetWithTags = Prisma.MediaAssetGetPayload<{ include: typeof withTags }>;

export interface CreateAssetInput {
  filename: string;
  originalName: string;
  url: string;
  mimeType: string;
  type: MediaAssetType;
  sizeBytes: number;
  altText?: string | null;
  folderId?: string | null;
  uploadedById?: string | null;
  tagNames?: string[];
}

/** `tagNames` are connected via `connectOrCreate` so re-tagging with an existing name never races a duplicate `MediaAssetTag` row. */
export function createAsset(input: CreateAssetInput): Promise<MediaAssetWithTags> {
  return prisma.mediaAsset.create({
    data: {
      filename: input.filename,
      originalName: input.originalName,
      url: input.url,
      mimeType: input.mimeType,
      type: input.type,
      sizeBytes: input.sizeBytes,
      altText: input.altText ?? null,
      folderId: input.folderId ?? null,
      uploadedById: input.uploadedById ?? null,
      tags: input.tagNames?.length
        ? { connectOrCreate: input.tagNames.map((name) => ({ where: { name }, create: { name } })) }
        : undefined,
    },
    include: withTags,
  });
}

export function findAssetById(id: string): Promise<MediaAssetWithTags | null> {
  return prisma.mediaAsset.findUnique({ where: { id }, include: withTags });
}

export interface UpdateAssetInput {
  altText?: string | null;
  folderId?: string | null;
  tagNames?: string[];
}

export function updateAsset(id: string, input: UpdateAssetInput): Promise<MediaAssetWithTags> {
  return prisma.mediaAsset.update({
    where: { id },
    data: {
      ...(input.altText !== undefined ? { altText: input.altText } : {}),
      ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
      ...(input.tagNames !== undefined
        ? { tags: { set: [], connectOrCreate: input.tagNames.map((name) => ({ where: { name }, create: { name } })) } }
        : {}),
    },
    include: withTags,
  });
}

export function deleteAssetById(id: string) {
  return prisma.mediaAsset.delete({ where: { id } });
}

export interface MediaAssetListFilters {
  folderId?: string;
  tagId?: string;
  type?: MediaAssetType;
  /** Matches originalName (case-insensitive substring). */
  search?: string;
}

function buildListWhere(filters: MediaAssetListFilters): Prisma.MediaAssetWhereInput {
  return {
    ...(filters.folderId ? { folderId: filters.folderId } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.tagId ? { tags: { some: { id: filters.tagId } } } : {}),
    ...(filters.search
      ? { originalName: { contains: escapeLikePattern(filters.search), mode: "insensitive" as const } }
      : {}),
  };
}

export async function listAssets(
  filters: MediaAssetListFilters,
  page: number,
  pageSize: number,
): Promise<{ items: MediaAssetWithTags[]; total: number }> {
  const where = buildListWhere(filters);
  const [items, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: withTags,
    }),
    prisma.mediaAsset.count({ where }),
  ]);
  return { items, total };
}

export function listAllTags() {
  return prisma.mediaAssetTag.findMany({ orderBy: { name: "asc" } });
}
