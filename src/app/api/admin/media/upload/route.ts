import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { mediaErrorResponse } from "@/lib/api/media-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { uploadAssets } from "@/services/media.service";
import { uploadMetadataSchema } from "@/validation/media.schema";

/**
 * `request.formData()` — the native Web API Next.js Route Handlers support
 * directly, no multer/formidable dependency needed. Multiple files share
 * the "files" field name (the browser client appends each one under that
 * key); `folderId`/`tagNames` (JSON-encoded array) ride alongside as plain
 * form fields.
 */
export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const formData = await request.formData();
  const fileEntries = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (fileEntries.length === 0) {
    return NextResponse.json({ error: "No files provided." }, { status: 400 });
  }

  const tagNamesRaw = formData.get("tagNames");
  const parsed = uploadMetadataSchema.safeParse({
    folderId: formData.get("folderId") || undefined,
    tagNames: typeof tagNamesRaw === "string" && tagNamesRaw.length > 0 ? JSON.parse(tagNamesRaw) : undefined,
  });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const files = await Promise.all(
      fileEntries.map(async (file) => ({
        buffer: Buffer.from(await file.arrayBuffer()),
        originalName: file.name,
        mimeType: file.type,
      })),
    );
    const result = await uploadAssets(session.user.id, files, { folderId: parsed.data.folderId, tagNames: parsed.data.tagNames });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return mediaErrorResponse(error, "POST /api/admin/media/upload");
  }
}
