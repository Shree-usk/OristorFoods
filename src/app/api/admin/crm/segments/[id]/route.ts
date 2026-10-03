import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { crmSegmentationErrorResponse } from "@/lib/api/crm-segmentation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteSegment, getSegment, updateSegment } from "@/services/crm-segmentation.service";
import { updateSegmentSchema } from "@/validation/crm-segmentation.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await getSegment(session.user.id, id));
  } catch (error) {
    return crmSegmentationErrorResponse(error, "GET /api/admin/crm/segments/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateSegmentSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateSegment(session.user.id, id, parsed.data));
  } catch (error) {
    return crmSegmentationErrorResponse(error, "PATCH /api/admin/crm/segments/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteSegment(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return crmSegmentationErrorResponse(error, "DELETE /api/admin/crm/segments/[id]");
  }
}
