import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { homepageBuilderErrorResponse } from "@/lib/api/homepage-builder-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { addSection } from "@/services/homepage-builder.service";
import { addSectionSchema } from "@/validation/homepage-builder.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = addSectionSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const section = await addSection(session.user.id, id, parsed.data.type);
    return NextResponse.json(section, { status: 201 });
  } catch (error) {
    return homepageBuilderErrorResponse(error, "POST /api/admin/homepage-builder/layouts/[id]/sections");
  }
}
