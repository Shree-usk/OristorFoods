import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { homepageBuilderErrorResponse } from "@/lib/api/homepage-builder-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { reorderSections } from "@/services/homepage-builder.service";
import { reorderSchema } from "@/validation/homepage-builder.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await reorderSections(session.user.id, id, parsed.data.orderedIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return homepageBuilderErrorResponse(error, "PATCH /api/admin/homepage-builder/layouts/[id]/sections/reorder");
  }
}
