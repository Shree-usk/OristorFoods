import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { homepageBuilderErrorResponse } from "@/lib/api/homepage-builder-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { duplicateSection } from "@/services/homepage-builder.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; sectionId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, sectionId } = await params;
  try {
    const section = await duplicateSection(session.user.id, id, sectionId);
    return NextResponse.json(section, { status: 201 });
  } catch (error) {
    return homepageBuilderErrorResponse(error, "POST /api/admin/homepage-builder/layouts/[id]/sections/[sectionId]/duplicate");
  }
}
