import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { mediaErrorResponse } from "@/lib/api/media-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteFolder, renameFolder } from "@/services/media.service";
import { renameFolderSchema } from "@/validation/media.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = renameFolderSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const folder = await renameFolder(session.user.id, id, parsed.data.name);
    return NextResponse.json(folder);
  } catch (error) {
    return mediaErrorResponse(error, "PATCH /api/admin/media/folders/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteFolder(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mediaErrorResponse(error, "DELETE /api/admin/media/folders/[id]");
  }
}
