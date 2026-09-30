import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { homepageBuilderErrorResponse } from "@/lib/api/homepage-builder-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { removeSection, updateSection } from "@/services/homepage-builder.service";
import { updateSectionSchema } from "@/validation/homepage-builder.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, sectionId } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateSectionSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const section = await updateSection(session.user.id, id, sectionId, parsed.data);
    return NextResponse.json(section);
  } catch (error) {
    return homepageBuilderErrorResponse(error, "PATCH /api/admin/homepage-builder/layouts/[id]/sections/[sectionId]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, sectionId } = await params;
  try {
    await removeSection(session.user.id, id, sectionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return homepageBuilderErrorResponse(error, "DELETE /api/admin/homepage-builder/layouts/[id]/sections/[sectionId]");
  }
}
