import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { homepageBuilderErrorResponse } from "@/lib/api/homepage-builder-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { removeBanner, updateBanner } from "@/services/homepage-builder.service";
import { updateHeroBannerSlideSchema } from "@/validation/homepage-builder.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; sectionId: string; bannerId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, sectionId, bannerId } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateHeroBannerSlideSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const banner = await updateBanner(session.user.id, id, sectionId, bannerId, parsed.data);
    return NextResponse.json(banner);
  } catch (error) {
    return homepageBuilderErrorResponse(error, "PATCH /api/admin/homepage-builder/layouts/[id]/sections/[sectionId]/banners/[bannerId]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; sectionId: string; bannerId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, sectionId, bannerId } = await params;
  try {
    await removeBanner(session.user.id, id, sectionId, bannerId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return homepageBuilderErrorResponse(error, "DELETE /api/admin/homepage-builder/layouts/[id]/sections/[sectionId]/banners/[bannerId]");
  }
}
