import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { landingPageAdminErrorResponse } from "@/lib/api/landing-page-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteBlock, updateBlock } from "@/services/landing-page.service";
import { landingPageBlockUpdateSchema } from "@/validation/landing-page.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ blockId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { blockId } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = landingPageBlockUpdateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const block = await updateBlock(session.user.id, blockId, parsed.data);
    return NextResponse.json(block);
  } catch (error) {
    return landingPageAdminErrorResponse(error, "PATCH /api/admin/marketing/landing-pages/blocks/[blockId]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ blockId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { blockId } = await params;
  try {
    await deleteBlock(session.user.id, blockId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return landingPageAdminErrorResponse(error, "DELETE /api/admin/marketing/landing-pages/blocks/[blockId]");
  }
}
