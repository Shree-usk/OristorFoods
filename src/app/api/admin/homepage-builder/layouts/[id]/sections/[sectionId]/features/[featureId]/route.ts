import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { homepageBuilderErrorResponse } from "@/lib/api/homepage-builder-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { removeFeature, updateFeature } from "@/services/homepage-builder.service";
import { updateHomepageSectionFeatureSchema } from "@/validation/homepage-builder.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; sectionId: string; featureId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, sectionId, featureId } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateHomepageSectionFeatureSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const feature = await updateFeature(session.user.id, id, sectionId, featureId, parsed.data);
    return NextResponse.json(feature);
  } catch (error) {
    return homepageBuilderErrorResponse(error, "PATCH /api/admin/homepage-builder/layouts/[id]/sections/[sectionId]/features/[featureId]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; sectionId: string; featureId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, sectionId, featureId } = await params;
  try {
    await removeFeature(session.user.id, id, sectionId, featureId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return homepageBuilderErrorResponse(error, "DELETE /api/admin/homepage-builder/layouts/[id]/sections/[sectionId]/features/[featureId]");
  }
}
