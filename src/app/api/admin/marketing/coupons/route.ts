import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { couponAdminErrorResponse } from "@/lib/api/coupon-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createCoupon, listCouponsForAdmin } from "@/services/coupon-admin.service";
import { couponSchema } from "@/validation/coupon-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const coupons = await listCouponsForAdmin(session.user.id);
    return NextResponse.json({ coupons });
  } catch (error) {
    return couponAdminErrorResponse(error, "GET /api/admin/marketing/coupons");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = couponSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const coupon = await createCoupon(session.user.id, {
      code: parsed.data.code,
      discountType: parsed.data.discountType,
      percentOff: parsed.data.percentOff != null ? parsed.data.percentOff.toFixed(2) : null,
      amountOff: parsed.data.amountOff != null ? parsed.data.amountOff.toFixed(2) : null,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      minOrderValue: parsed.data.minOrderValue != null ? parsed.data.minOrderValue.toFixed(2) : null,
      usageLimitGlobal: parsed.data.usageLimitGlobal ?? null,
      usageLimitPerCustomer: parsed.data.usageLimitPerCustomer ?? null,
      scope: parsed.data.scope,
      stackable: parsed.data.stackable,
      scopeProductIds: parsed.data.scopeProductIds ?? [],
      scopeCategoryIds: parsed.data.scopeCategoryIds ?? [],
    });
    return NextResponse.json(coupon, { status: 201 });
  } catch (error) {
    return couponAdminErrorResponse(error, "POST /api/admin/marketing/coupons");
  }
}
