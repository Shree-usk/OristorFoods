import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { homepageBuilderErrorResponse } from "@/lib/api/homepage-builder-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { publishLayout } from "@/services/homepage-builder.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const layout = await publishLayout(session.user.id, id);
    return NextResponse.json(layout);
  } catch (error) {
    return homepageBuilderErrorResponse(error, "POST /api/admin/homepage-builder/layouts/[id]/publish");
  }
}
