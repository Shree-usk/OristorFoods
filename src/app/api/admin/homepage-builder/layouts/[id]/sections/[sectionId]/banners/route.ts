import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { homepageBuilderErrorResponse } from "@/lib/api/homepage-builder-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { addBanner } from "@/services/homepage-builder.service";
import { heroBannerSlideSchema } from "@/validation/homepage-builder.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, sectionId } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = heroBannerSlideSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const banner = await addBanner(session.user.id, id, sectionId, parsed.data);
    return NextResponse.json(banner, { status: 201 });
  } catch (error) {
    return homepageBuilderErrorResponse(error, "POST /api/admin/homepage-builder/layouts/[id]/sections/[sectionId]/banners");
  }
}
