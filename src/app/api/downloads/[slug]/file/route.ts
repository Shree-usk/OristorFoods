import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { downloadErrorResponse } from "@/lib/api/download-responses";
import { recordDownload, resolveFileAccess } from "@/services/download.service";

const DOWNLOADS_DIR = path.resolve(process.cwd(), "public", "downloads");

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const session = await auth();
    const resource = await resolveFileAccess(slug, Boolean(session?.user?.id));

    // resource.fileUrl is admin-authored data (Epic 07's Media Library),
    // not a trusted constant — resolve it and reject anything that
    // escapes public/downloads/ (e.g. "/../.env") before ever reading it.
    const resolvedPath = path.resolve(process.cwd(), "public", `.${resource.fileUrl}`);
    if (resolvedPath !== DOWNLOADS_DIR && !resolvedPath.startsWith(DOWNLOADS_DIR + path.sep)) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    let bytes: Buffer;
    try {
      bytes = await readFile(resolvedPath);
    } catch {
      // Metadata/file drift (a DownloadResource row survives its file being
      // moved/deleted) — a clean 404, never an unhandled fs exception
      // surfacing as a raw 500 (the AC's "fail gracefully" requirement).
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    await recordDownload(resource.id);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": resource.fileType === "PDF" ? "application/pdf" : "application/octet-stream",
        "Content-Disposition": `attachment; filename="${resource.slug}.pdf"`,
      },
    });
  } catch (error) {
    return downloadErrorResponse(error);
  }
}
