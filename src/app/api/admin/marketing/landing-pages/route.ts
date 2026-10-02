import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { landingPageAdminErrorResponse } from "@/lib/api/landing-page-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createLandingPage, listLandingPagesForAdmin } from "@/services/landing-page.service";
import { landingPageSchema } from "@/validation/landing-page.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const landingPages = await listLandingPagesForAdmin(session.user.id);
    return NextResponse.json({ landingPages });
  } catch (error) {
    return landingPageAdminErrorResponse(error, "GET /api/admin/marketing/landing-pages");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = landingPageSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const landingPage = await createLandingPage(session.user.id, {
      name: parsed.data.name,
      slug: parsed.data.slug,
      metaTitle: parsed.data.metaTitle ?? null,
      metaDescription: parsed.data.metaDescription ?? null,
    });
    return NextResponse.json(landingPage, { status: 201 });
  } catch (error) {
    return landingPageAdminErrorResponse(error, "POST /api/admin/marketing/landing-pages");
  }
}
