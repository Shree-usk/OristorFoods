import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { homepageBuilderErrorResponse } from "@/lib/api/homepage-builder-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { deleteDraftLayout, getLayout } from "@/services/homepage-builder.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const layout = await getLayout(session.user.id, id);
    return NextResponse.json(layout);
  } catch (error) {
    return homepageBuilderErrorResponse(error, "GET /api/admin/homepage-builder/layouts/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteDraftLayout(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return homepageBuilderErrorResponse(error, "DELETE /api/admin/homepage-builder/layouts/[id]");
  }
}
