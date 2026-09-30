import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { homepageBuilderErrorResponse } from "@/lib/api/homepage-builder-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createDraftLayout, listLayouts } from "@/services/homepage-builder.service";
import { createDraftLayoutSchema, listLayoutsQuerySchema } from "@/validation/homepage-builder.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const parsed = listLayoutsQuerySchema.safeParse({ status: searchParams.get("status") ?? undefined });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const layouts = await listLayouts(session.user.id, parsed.data.status);
    return NextResponse.json({ layouts });
  } catch (error) {
    return homepageBuilderErrorResponse(error, "GET /api/admin/homepage-builder/layouts");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = createDraftLayoutSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const layout = await createDraftLayout(session.user.id, parsed.data);
    return NextResponse.json(layout, { status: 201 });
  } catch (error) {
    return homepageBuilderErrorResponse(error, "POST /api/admin/homepage-builder/layouts");
  }
}
