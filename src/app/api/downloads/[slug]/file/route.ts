import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { downloadErrorResponse } from "@/lib/api/download-responses";
import { recordDownload, resolveFileAccess } from "@/services/download.service";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const session = await auth();
    const resource = await resolveFileAccess(slug, Boolean(session?.user?.id));

    let bytes: Buffer;
    try {
      bytes = await readFile(path.join(process.cwd(), "public", resource.fileUrl));
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
