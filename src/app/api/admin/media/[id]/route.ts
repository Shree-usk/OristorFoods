import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { mediaErrorResponse } from "@/lib/api/media-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteAsset, getAsset, updateAsset } from "@/services/media.service";
import { updateAssetSchema } from "@/validation/media.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const asset = await getAsset(session.user.id, id);
    return NextResponse.json(asset);
  } catch (error) {
    return mediaErrorResponse(error, "GET /api/admin/media/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateAssetSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const asset = await updateAsset(session.user.id, id, parsed.data);
    return NextResponse.json(asset);
  } catch (error) {
    return mediaErrorResponse(error, "PATCH /api/admin/media/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteAsset(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mediaErrorResponse(error, "DELETE /api/admin/media/[id]");
  }
}
