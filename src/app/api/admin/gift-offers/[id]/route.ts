import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { giftOfferAdminErrorResponse } from "@/lib/api/gift-offer-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getGiftOfferAdminDetail, updateGiftOffer } from "@/services/gift-offer-admin.service";
import { updateGiftOfferSchema } from "@/validation/gift-offer-admin.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const giftOffer = await getGiftOfferAdminDetail(session.user.id, id);
    return NextResponse.json(giftOffer);
  } catch (error) {
    return giftOfferAdminErrorResponse(error, "GET /api/admin/gift-offers/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateGiftOfferSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const giftOffer = await updateGiftOffer(session.user.id, id, parsed.data);
    return NextResponse.json(giftOffer);
  } catch (error) {
    return giftOfferAdminErrorResponse(error, "PATCH /api/admin/gift-offers/[id]");
  }
}
