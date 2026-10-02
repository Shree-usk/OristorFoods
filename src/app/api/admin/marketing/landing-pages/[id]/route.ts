import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { landingPageAdminErrorResponse } from "@/lib/api/landing-page-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getLandingPageAdminDetail, updateLandingPage } from "@/services/landing-page.service";
import { landingPageUpdateSchema } from "@/validation/landing-page.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const landingPage = await getLandingPageAdminDetail(session.user.id, id);
    return NextResponse.json(landingPage);
  } catch (error) {
    return landingPageAdminErrorResponse(error, "GET /api/admin/marketing/landing-pages/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = landingPageUpdateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const landingPage = await updateLandingPage(session.user.id, id, parsed.data);
    return NextResponse.json(landingPage);
  } catch (error) {
    return landingPageAdminErrorResponse(error, "PATCH /api/admin/marketing/landing-pages/[id]");
  }
}
