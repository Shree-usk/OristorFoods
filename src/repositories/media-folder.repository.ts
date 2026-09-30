import type { MediaFolder } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-041. The only place MediaFolder is queried/mutated. */

export function createFolder(name: string, parentId: string | null) {
  return prisma.mediaFolder.create({ data: { name, parentId } });
}

export function findFolderById(id: string) {
  return prisma.mediaFolder.findUnique({ where: { id } });
}

export function renameFolder(id: string, name: string) {
  return prisma.mediaFolder.update({ where: { id }, data: { name } });
}

export function moveFolder(id: string, parentId: string | null) {
  return prisma.mediaFolder.update({ where: { id }, data: { parentId } });
}

export function deleteFolder(id: string) {
  return prisma.mediaFolder.delete({ where: { id } });
}

/** A folder is safe to delete only when empty — see MediaFolderNotEmptyError's caller in media.service.ts. */
export async function isFolderEmpty(id: string): Promise<boolean> {
  const [childCount, assetCount] = await Promise.all([
    prisma.mediaFolder.count({ where: { parentId: id } }),
    prisma.mediaAsset.count({ where: { folderId: id } }),
  ]);
  return childCount === 0 && assetCount === 0;
}

export function listAllFolders() {
  return prisma.mediaFolder.findMany({ orderBy: { name: "asc" } });
}

export interface MediaFolderTreeNode extends MediaFolder {
  children: MediaFolderTreeNode[];
}

/** Same flat-list-to-tree shape as category.repository.ts::getCategoryTree. */
export async function getFolderTree(): Promise<MediaFolderTreeNode[]> {
  const all = await listAllFolders();
  const byParent = new Map<string | null, MediaFolder[]>();
  for (const folder of all) {
    const key = folder.parentId;
    const bucket = byParent.get(key) ?? [];
    bucket.push(folder);
    byParent.set(key, bucket);
  }
  function build(parentId: string | null): MediaFolderTreeNode[] {
    return (byParent.get(parentId) ?? []).map((folder) => ({
      ...folder,
      children: build(folder.id),
    }));
  }
  return build(null);
}
