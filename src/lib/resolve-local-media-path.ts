import { readFile } from "node:fs/promises";
import path from "node:path";

import { LOCAL_MEDIA_UPLOAD_DIR } from "@/services/storage/local-disk-storage.provider";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const MEDIA_FILES_PREFIX = "/media-files/";

function resolveWithinDir(baseDir: string, relative: string): string | null {
  const resolved = path.resolve(baseDir, `.${relative}`);
  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) return null;
  return resolved;
}

/**
 * Reads a product/collection image URL's bytes directly off local disk —
 * used by export-catalogue-pdf.service.tsx to embed packshots in a
 * server-rendered PDF, where @react-pdf/renderer's `Image` needs either a
 * real URL or a real filesystem path, not the root-relative `/images/...`
 * or `/media-files/...` strings these fields actually store.
 *
 * Two physical locations, same split as media-files/[...filename]/route.ts
 * and local-disk-storage.provider.ts: a runtime-uploaded Media Library
 * asset lives in `.local-media-uploads/` (outside `public/`, see that
 * provider's own doc comment), everything else (seeded/build-time images)
 * is a normal file under `public/`. `url` is admin-authored data via the
 * AssetPickerDialog, not a trusted constant — resolution is clamped to the
 * matching directory the same way download.service.ts's file route guards
 * against path traversal (e.g. a crafted "/../../.env").
 *
 * Returns null (never throws) on a missing/unreadable/out-of-bounds file,
 * matching the spec's "handle... missing optional data" requirement — a
 * product with a broken image reference is simply rendered without one.
 */
export async function readLocalMediaFile(url: string): Promise<Buffer | null> {
  const resolvedPath = url.startsWith(MEDIA_FILES_PREFIX)
    ? resolveWithinDir(LOCAL_MEDIA_UPLOAD_DIR, url.slice(MEDIA_FILES_PREFIX.length - 1))
    : resolveWithinDir(PUBLIC_DIR, url);
  if (!resolvedPath) return null;

  try {
    return await readFile(resolvedPath);
  } catch {
    return null;
  }
}
