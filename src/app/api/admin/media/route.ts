import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { mediaErrorResponse } from "@/lib/api/media-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listMediaAssets } from "@/services/media.service";
import { listMediaQuerySchema } from "@/validation/media.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const parsed = listMediaQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { page, pageSize, folderId, tagId, type, search } = parsed.data;

  try {
    const result = await listMediaAssets(session.user.id, { folderId, tagId, type, search }, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return mediaErrorResponse(error, "GET /api/admin/media");
  }
}
