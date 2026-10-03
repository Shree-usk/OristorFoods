import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { deliveryZoneErrorResponse } from "@/lib/api/delivery-zone-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createOverride, listOverridesForZone } from "@/services/delivery-override.service";
import { deliveryOverrideInputSchema } from "@/validation/delivery-zone.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await listOverridesForZone(session.user.id, id));
  } catch (error) {
    return deliveryZoneErrorResponse(error, "GET /api/admin/delivery-zones/[id]/overrides");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = deliveryOverrideInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const override = await createOverride(session.user.id, id, parsed.data);
    return NextResponse.json(override, { status: 201 });
  } catch (error) {
    return deliveryZoneErrorResponse(error, "POST /api/admin/delivery-zones/[id]/overrides");
  }
}
