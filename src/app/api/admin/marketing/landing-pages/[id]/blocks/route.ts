import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { landingPageAdminErrorResponse } from "@/lib/api/landing-page-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createBlock } from "@/services/landing-page.service";
import { landingPageBlockSchema } from "@/validation/landing-page.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = landingPageBlockSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const block = await createBlock(session.user.id, id, {
      ...parsed.data,
      subheadline: parsed.data.subheadline ?? null,
      supportingText: parsed.data.supportingText ?? null,
      ctaLabel: parsed.data.ctaLabel ?? null,
      ctaHref: parsed.data.ctaHref ?? null,
      secondaryCtaLabel: parsed.data.secondaryCtaLabel ?? null,
      secondaryCtaHref: parsed.data.secondaryCtaHref ?? null,
      mobileImageUrl: parsed.data.mobileImageUrl ?? null,
      mobileImageAlt: parsed.data.mobileImageAlt ?? null,
      videoUrl: parsed.data.videoUrl ?? null,
    });
    return NextResponse.json(block, { status: 201 });
  } catch (error) {
    return landingPageAdminErrorResponse(error, "POST /api/admin/marketing/landing-pages/[id]/blocks");
  }
}
