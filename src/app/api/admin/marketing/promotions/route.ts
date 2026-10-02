import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { couponAdminErrorResponse } from "@/lib/api/coupon-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createPromotion, listPromotionsForAdmin } from "@/services/coupon-admin.service";
import { promotionSchema } from "@/validation/coupon-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const promotions = await listPromotionsForAdmin(session.user.id);
    return NextResponse.json({ promotions });
  } catch (error) {
    return couponAdminErrorResponse(error, "GET /api/admin/marketing/promotions");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = promotionSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const promotion = await createPromotion(session.user.id, {
      name: parsed.data.name,
      displayLabel: parsed.data.displayLabel,
      discountType: parsed.data.discountType,
      percentOff: parsed.data.percentOff != null ? parsed.data.percentOff.toFixed(2) : null,
      amountOff: parsed.data.amountOff != null ? parsed.data.amountOff.toFixed(2) : null,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      minOrderValue: parsed.data.minOrderValue != null ? parsed.data.minOrderValue.toFixed(2) : null,
      scope: parsed.data.scope,
      stackable: parsed.data.stackable,
      priority: parsed.data.priority,
      scopeProductIds: parsed.data.scopeProductIds ?? [],
      scopeCategoryIds: parsed.data.scopeCategoryIds ?? [],
    });
    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    return couponAdminErrorResponse(error, "POST /api/admin/marketing/promotions");
  }
}
