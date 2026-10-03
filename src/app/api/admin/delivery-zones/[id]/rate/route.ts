import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { deliveryZoneErrorResponse } from "@/lib/api/delivery-zone-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { upsertZoneRate } from "@/services/delivery-rate.service";
import { deliveryRateInputSchema } from "@/validation/delivery-zone.schema";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = deliveryRateInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await upsertZoneRate(session.user.id, id, parsed.data));
  } catch (error) {
    return deliveryZoneErrorResponse(error, "PUT /api/admin/delivery-zones/[id]/rate");
  }
}
