import { randomUUID } from "node:crypto";

import type { MediaAssetType } from "@/generated/prisma/client";
import * as mediaFolderRepository from "@/repositories/media-folder.repository";
import * as mediaRepository from "@/repositories/media.repository";
import type { MediaAssetListFilters, MediaAssetWithTags } from "@/repositories/media.repository";
import { requirePermission } from "@/services/permission.service";
import { writeAuditLog } from "@/services/audit-log.service";
import {
  MediaAssetMissingAltTextError,
  MediaAssetNotFoundError,
  MediaFolderNotEmptyError,
  MediaFolderNotFoundError,
  MediaUploadValidationError,
} from "@/services/media.errors";
import { LocalDiskStorageProvider } from "@/services/storage/local-disk-storage.provider";
import type { StorageProvider } from "@/services/storage/storage-provider.interface";

/**
 * Provider-agnostic — the ONE place a concrete storage adapter may be
 * imported once the hosting/cloud decision (blueprint.md Section 10) is
 * made. "local" is the only valid `MEDIA_STORAGE_PROVIDER` value until
 * then, mirroring payment.service.ts::getActiveProvider() exactly.
 */
function getActiveStorageProvider(): StorageProvider {
  const configured = process.env.MEDIA_STORAGE_PROVIDER ?? "local";
  if (configured === "local") return new LocalDiskStorageProvider();
  throw new Error(`Unsupported MEDIA_STORAGE_PROVIDER "${configured}" — only "local" exists until the storage decision (blueprint Section 10) is made.`);
}

/**
 * Placeholder pending a real System Settings-backed value — not in
 * STORY-054's own scope (that story's Low Stock threshold was the
 * analogous case this comment used to point at, now resolved to a
 * real `InventorySetting` row — see system-settings.service.ts).
 */
const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES: Record<string, { extension: string; type: MediaAssetType }> = {
  "image/jpeg": { extension: "jpg", type: "Image" },
  "image/png": { extension: "png", type: "Image" },
  "image/webp": { extension: "webp", type: "Image" },
  "image/svg+xml": { extension: "svg", type: "Image" },
  "video/mp4": { extension: "mp4", type: "Video" },
  "application/pdf": { extension: "pdf", type: "Document" },
};

function slugifyBasename(originalName: string): string {
  const base = originalName.replace(/\.[^./]+$/, "");
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "file";
}

/** Never trusts the raw uploaded filename — path separators and everything else are stripped via the slug, and the extension comes from the validated MIME type, not the client-supplied one. */
function buildSafeFilename(originalName: string, extension: string): string {
  return `${randomUUID()}-${slugifyBasename(originalName)}.${extension}`;
}

export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface UploadOptions {
  folderId?: string | null;
  tagNames?: string[];
}

export interface BulkUploadResult {
  succeeded: MediaAssetWithTags[];
  failed: { originalName: string; reason: string }[];
}

/**
 * Each file is validated and stored independently — a failed file (wrong
 * MIME type, too large) is collected into `failed` and never blocks the
 * rest of the batch (AC).
 */
export async function uploadAssets(adminUserId: string, files: UploadFileInput[], opts: UploadOptions = {}): Promise<BulkUploadResult> {
  await requirePermission(adminUserId, "MediaLibrary", "Edit");

  const provider = getActiveStorageProvider();
  const result: BulkUploadResult = { succeeded: [], failed: [] };

  for (const file of files) {
    try {
      const allowed = ALLOWED_MIME_TYPES[file.mimeType];
      if (!allowed) {
        throw new MediaUploadValidationError(`"${file.mimeType}" is not an allowed file type.`);
      }
      if (file.buffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
        throw new MediaUploadValidationError(`File exceeds the ${Math.floor(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))}MB limit.`);
      }

      const safeFilename = buildSafeFilename(file.originalName, allowed.extension);
      const { url } = await provider.upload({ buffer: file.buffer, safeFilename });

      const asset = await mediaRepository.createAsset({
        filename: safeFilename,
        originalName: file.originalName,
        url,
        mimeType: file.mimeType,
        type: allowed.type,
        sizeBytes: file.buffer.byteLength,
        folderId: opts.folderId,
        tagNames: opts.tagNames,
        uploadedById: adminUserId,
      });

      await writeAuditLog({ actorId: adminUserId, action: "media_uploaded", module: "MediaLibrary", targetType: "MediaAsset", targetId: asset.id });
      result.succeeded.push(asset);
    } catch (error) {
      const reason = error instanceof MediaUploadValidationError ? error.message : "Upload failed.";
      result.failed.push({ originalName: file.originalName, reason });
    }
  }

  return result;
}

export async function listMediaAssets(adminUserId: string, filters: MediaAssetListFilters, page: number, pageSize: number) {
  await requirePermission(adminUserId, "MediaLibrary", "View");
  return mediaRepository.listAssets(filters, page, pageSize);
}

export async function getAsset(adminUserId: string, id: string): Promise<MediaAssetWithTags> {
  await requirePermission(adminUserId, "MediaLibrary", "View");
  const asset = await mediaRepository.findAssetById(id);
  if (!asset) throw new MediaAssetNotFoundError();
  return asset;
}

/**
 * The picker-side gate: AssetPickerDialog calls this (via the API) rather
 * than trusting the client to have checked altText itself, so the
 * requirement is real, not a form-level nicety (AC).
 */
export async function selectAssetForPicker(adminUserId: string, id: string): Promise<MediaAssetWithTags> {
  const asset = await getAsset(adminUserId, id);
  if (!asset.altText || asset.altText.trim().length === 0) throw new MediaAssetMissingAltTextError();
  return asset;
}

export interface UpdateAssetInput {
  altText?: string | null;
  folderId?: string | null;
  tagNames?: string[];
}

export async function updateAsset(adminUserId: string, id: string, input: UpdateAssetInput): Promise<MediaAssetWithTags> {
  await requirePermission(adminUserId, "MediaLibrary", "Edit");
  const existing = await mediaRepository.findAssetById(id);
  if (!existing) throw new MediaAssetNotFoundError();

  const updated = await mediaRepository.updateAsset(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "media_updated", module: "MediaLibrary", targetType: "MediaAsset", targetId: id });
  return updated;
}

/** No usage-before-delete guard this pass — every existing image field is still a plain string, not an FK; see docs/architecture-decisions.md. */
export async function deleteAsset(adminUserId: string, id: string): Promise<void> {
  await requirePermission(adminUserId, "MediaLibrary", "Delete");
  const existing = await mediaRepository.findAssetById(id);
  if (!existing) throw new MediaAssetNotFoundError();

  await mediaRepository.deleteAssetById(id);
  await getActiveStorageProvider().delete(existing.url);
  await writeAuditLog({ actorId: adminUserId, action: "media_deleted", module: "MediaLibrary", targetType: "MediaAsset", targetId: id });
}

export function listTags() {
  return mediaRepository.listAllTags();
}

// --- Folders ---

export async function listFolderTree(adminUserId: string) {
  await requirePermission(adminUserId, "MediaLibrary", "View");
  return mediaFolderRepository.getFolderTree();
}

export async function createFolder(adminUserId: string, name: string, parentId: string | null) {
  await requirePermission(adminUserId, "MediaLibrary", "Edit");
  if (parentId) {
    const parent = await mediaFolderRepository.findFolderById(parentId);
    if (!parent) throw new MediaFolderNotFoundError();
  }
  const folder = await mediaFolderRepository.createFolder(name, parentId);
  await writeAuditLog({ actorId: adminUserId, action: "media_folder_created", module: "MediaLibrary", targetType: "MediaFolder", targetId: folder.id });
  return folder;
}

export async function renameFolder(adminUserId: string, id: string, name: string) {
  await requirePermission(adminUserId, "MediaLibrary", "Edit");
  const existing = await mediaFolderRepository.findFolderById(id);
  if (!existing) throw new MediaFolderNotFoundError();

  const folder = await mediaFolderRepository.renameFolder(id, name);
  await writeAuditLog({ actorId: adminUserId, action: "media_folder_renamed", module: "MediaLibrary", targetType: "MediaFolder", targetId: id });
  return folder;
}

export async function deleteFolder(adminUserId: string, id: string): Promise<void> {
  await requirePermission(adminUserId, "MediaLibrary", "Delete");
  const existing = await mediaFolderRepository.findFolderById(id);
  if (!existing) throw new MediaFolderNotFoundError();
  if (!(await mediaFolderRepository.isFolderEmpty(id))) throw new MediaFolderNotEmptyError();

  await mediaFolderRepository.deleteFolder(id);
  await writeAuditLog({ actorId: adminUserId, action: "media_folder_deleted", module: "MediaLibrary", targetType: "MediaFolder", targetId: id });
}
