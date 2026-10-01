import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { customerAdminErrorResponse } from "@/lib/api/customer-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { issueCoupon } from "@/services/customer-admin.service";
import { issueCouponSchema } from "@/validation/customer-admin.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = issueCouponSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const coupon = await issueCoupon(session.user.id, id, {
      discountType: parsed.data.discountType,
      percentOff: parsed.data.percentOff ?? null,
      amountOff: parsed.data.amountOff ?? null,
      expiresInDays: parsed.data.expiresInDays,
      usageLimit: parsed.data.usageLimit,
    });
    return NextResponse.json(coupon, { status: 201 });
  } catch (error) {
    return customerAdminErrorResponse(error, "POST /api/admin/customers/[id]/coupons/issue");
  }
}
