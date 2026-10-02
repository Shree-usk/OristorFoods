import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { popupAdminErrorResponse } from "@/lib/api/popup-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createPopup, listPopupsForAdmin } from "@/services/popup.service";
import { popupSchema } from "@/validation/popup.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const popups = await listPopupsForAdmin(session.user.id);
    return NextResponse.json({ popups });
  } catch (error) {
    return popupAdminErrorResponse(error, "GET /api/admin/marketing/popups");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = popupSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const popup = await createPopup(session.user.id, {
      ...parsed.data,
      description: parsed.data.description ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      imageAlt: parsed.data.imageAlt ?? null,
      mobileImageUrl: parsed.data.mobileImageUrl ?? null,
      mobileImageAlt: parsed.data.mobileImageAlt ?? null,
      videoUrl: parsed.data.videoUrl ?? null,
      ctaLabel: parsed.data.ctaLabel ?? null,
      ctaHref: parsed.data.ctaHref ?? null,
      secondaryCtaLabel: parsed.data.secondaryCtaLabel ?? null,
      secondaryCtaHref: parsed.data.secondaryCtaHref ?? null,
      couponCode: parsed.data.couponCode ?? null,
      targetCustomerGroup: parsed.data.targetCustomerGroup ?? null,
      triggerValue: parsed.data.triggerValue ?? null,
      startAt: parsed.data.startAt ?? null,
      endAt: parsed.data.endAt ?? null,
      variantGroupId: parsed.data.variantGroupId ?? null,
    });
    return NextResponse.json(popup, { status: 201 });
  } catch (error) {
    return popupAdminErrorResponse(error, "POST /api/admin/marketing/popups");
  }
}
