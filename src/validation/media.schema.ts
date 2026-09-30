import { z } from "zod";

const mediaAssetTypeEnum = z.enum(["Image", "Video", "Document"]);

/** MIME/size checks run against the actual uploaded `File` in the route handler — see media.service.ts::uploadAssets — not part of this schema. */
export const uploadMetadataSchema = z.object({
  folderId: z.string().min(1).optional(),
  tagNames: z.array(z.string().trim().min(1)).optional(),
});

export const updateAssetSchema = z.object({
  altText: z.string().trim().max(300).optional().nullable(),
  folderId: z.string().min(1).optional().nullable(),
  tagNames: z.array(z.string().trim().min(1)).optional(),
});

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, "Folder name is required.").max(100),
  parentId: z.string().min(1).optional().nullable(),
});

export const renameFolderSchema = z.object({
  name: z.string().trim().min(1, "Folder name is required.").max(100),
});

export const listMediaQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(24),
  folderId: z.string().min(1).optional(),
  tagId: z.string().min(1).optional(),
  type: mediaAssetTypeEnum.optional(),
  search: z.string().trim().min(1).optional(),
});
