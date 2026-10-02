import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { redirectAdminErrorResponse } from "@/lib/api/redirect-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createRedirect, listRedirectsForAdmin } from "@/services/redirect.service";
import { redirectSchema } from "@/validation/redirect.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const redirects = await listRedirectsForAdmin(session.user.id);
    return NextResponse.json({ redirects });
  } catch (error) {
    return redirectAdminErrorResponse(error, "GET /api/admin/seo/redirects");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = redirectSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const redirect = await createRedirect(session.user.id, parsed.data);
    return NextResponse.json(redirect, { status: 201 });
  } catch (error) {
    return redirectAdminErrorResponse(error, "POST /api/admin/seo/redirects");
  }
}
