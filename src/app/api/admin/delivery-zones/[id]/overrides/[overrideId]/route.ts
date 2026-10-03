import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { deliveryZoneErrorResponse } from "@/lib/api/delivery-zone-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteOverride, updateOverride } from "@/services/delivery-override.service";
import { updateDeliveryOverrideInputSchema } from "@/validation/delivery-zone.schema";

export async function PUT(request: Request, { params }: { params: Promise<{ overrideId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { overrideId } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateDeliveryOverrideInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateOverride(session.user.id, overrideId, parsed.data));
  } catch (error) {
    return deliveryZoneErrorResponse(error, "PUT /api/admin/delivery-zones/[id]/overrides/[overrideId]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ overrideId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { overrideId } = await params;
  try {
    await deleteOverride(session.user.id, overrideId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return deliveryZoneErrorResponse(error, "DELETE /api/admin/delivery-zones/[id]/overrides/[overrideId]");
  }
}
