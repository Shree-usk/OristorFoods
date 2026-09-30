import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { LOCAL_MEDIA_UPLOAD_DIR } from "@/services/storage/local-disk-storage.provider";

/**
 * Serves LocalDiskStorageProvider's uploads from outside `public/` (see
 * that file's doc comment for why). Unauthenticated by design — these
 * URLs are meant to be embedded as plain image/video `src` attributes
 * anywhere (admin previews today, eventually storefront pages once a
 * consuming module goes live), the same trust level as any other public
 * asset URL.
 */
const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  pdf: "application/pdf",
};

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string[] }> }) {
  const { filename: segments } = await params;
  // Exactly one segment expected (LocalDiskStorageProvider never nests
  // subdirectories) — reject anything else, including any attempt at
  // path traversal via an unexpected segment count or "..".
  if (segments.length !== 1 || segments[0].includes("..") || segments[0].includes("/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = segments[0];
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const contentType = EXTENSION_CONTENT_TYPES[extension];
  if (!contentType) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const data = await readFile(path.join(LOCAL_MEDIA_UPLOAD_DIR, filename));
    return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
