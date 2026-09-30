import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StorageProvider, StorageUploadInput, StorageUploadResult } from "@/services/storage/storage-provider.interface";

/**
 * Writes to `.local-media-uploads/` at the project root — deliberately
 * OUTSIDE `public/`. Next.js's dev server watches `public/` specifically
 * to notify the browser about new static assets, so writing runtime
 * uploads there triggers a Fast Refresh cycle on every upload — which can
 * remount a form and silently discard whatever the admin was mid-editing
 * (found via STORY-041's own AssetPickerDialog integration test). Served
 * back by `src/app/media-files/[...filename]/route.ts` instead of Next's
 * automatic `public/` static handling. The dev-only, no-cloud-provider-yet
 * implementation (STORY-041) — see storage-provider.interface.ts's doc
 * comment.
 */
const UPLOAD_DIR = path.join(process.cwd(), ".local-media-uploads");
const URL_PREFIX = "/media-files";

export class LocalDiskStorageProvider implements StorageProvider {
  readonly name = "local";

  async upload({ buffer, safeFilename }: StorageUploadInput): Promise<StorageUploadResult> {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, safeFilename), buffer);
    return { url: `${URL_PREFIX}/${safeFilename}` };
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith(`${URL_PREFIX}/`)) return;
    const filename = url.slice(`${URL_PREFIX}/`.length);
    try {
      await unlink(path.join(UPLOAD_DIR, filename));
    } catch (error) {
      // Tolerant of "already gone" — anything else re-throws.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export const LOCAL_MEDIA_UPLOAD_DIR = UPLOAD_DIR;
