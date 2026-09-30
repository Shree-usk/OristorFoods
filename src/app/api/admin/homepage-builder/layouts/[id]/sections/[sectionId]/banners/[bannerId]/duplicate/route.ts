import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { homepageBuilderErrorResponse } from "@/lib/api/homepage-builder-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { duplicateBanner } from "@/services/homepage-builder.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; sectionId: string; bannerId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, sectionId, bannerId } = await params;
  try {
    const banner = await duplicateBanner(session.user.id, id, sectionId, bannerId);
    return NextResponse.json(banner, { status: 201 });
  } catch (error) {
    return homepageBuilderErrorResponse(error, "POST /api/admin/homepage-builder/layouts/[id]/sections/[sectionId]/banners/[bannerId]/duplicate");
  }
}
