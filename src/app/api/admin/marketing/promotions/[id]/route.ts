import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { couponAdminErrorResponse } from "@/lib/api/coupon-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getPromotionAdminDetail, updatePromotion } from "@/services/coupon-admin.service";
import { promotionUpdateSchema } from "@/validation/coupon-admin.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const promotion = await getPromotionAdminDetail(session.user.id, id);
    return NextResponse.json(promotion);
  } catch (error) {
    return couponAdminErrorResponse(error, "GET /api/admin/marketing/promotions/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = promotionUpdateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const promotion = await updatePromotion(session.user.id, id, {
      ...parsed.data,
      percentOff: parsed.data.percentOff != null ? parsed.data.percentOff.toFixed(2) : parsed.data.percentOff,
      amountOff: parsed.data.amountOff != null ? parsed.data.amountOff.toFixed(2) : parsed.data.amountOff,
      minOrderValue: parsed.data.minOrderValue != null ? parsed.data.minOrderValue.toFixed(2) : parsed.data.minOrderValue,
    });
    return NextResponse.json(promotion);
  } catch (error) {
    return couponAdminErrorResponse(error, "PATCH /api/admin/marketing/promotions/[id]");
  }
}
