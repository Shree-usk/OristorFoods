import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { deliveryZoneErrorResponse } from "@/lib/api/delivery-zone-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteZone, getZoneDetail, updateZone } from "@/services/delivery-zone.service";
import { deliveryZoneInputSchema } from "@/validation/delivery-zone.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await getZoneDetail(session.user.id, id));
  } catch (error) {
    return deliveryZoneErrorResponse(error, "GET /api/admin/delivery-zones/[id]");
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = deliveryZoneInputSchema.partial().safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateZone(session.user.id, id, parsed.data));
  } catch (error) {
    return deliveryZoneErrorResponse(error, "PUT /api/admin/delivery-zones/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteZone(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return deliveryZoneErrorResponse(error, "DELETE /api/admin/delivery-zones/[id]");
  }
}
