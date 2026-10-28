import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { giftOfferAdminErrorResponse } from "@/lib/api/gift-offer-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createGiftOffer, listGiftOffersForAdmin } from "@/services/gift-offer-admin.service";
import { createGiftOfferSchema } from "@/validation/gift-offer-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const giftOffers = await listGiftOffersForAdmin(session.user.id);
    return NextResponse.json({ giftOffers });
  } catch (error) {
    return giftOfferAdminErrorResponse(error, "GET /api/admin/gift-offers");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = createGiftOfferSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const giftOffer = await createGiftOffer(session.user.id, parsed.data);
    return NextResponse.json(giftOffer, { status: 201 });
  } catch (error) {
    return giftOfferAdminErrorResponse(error, "POST /api/admin/gift-offers");
  }
}
