import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { mediaErrorResponse } from "@/lib/api/media-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createFolder, listFolderTree } from "@/services/media.service";
import { createFolderSchema } from "@/validation/media.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const tree = await listFolderTree(session.user.id);
    return NextResponse.json({ tree });
  } catch (error) {
    return mediaErrorResponse(error, "GET /api/admin/media/folders");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = createFolderSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const folder = await createFolder(session.user.id, parsed.data.name, parsed.data.parentId ?? null);
    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    return mediaErrorResponse(error, "POST /api/admin/media/folders");
  }
}
