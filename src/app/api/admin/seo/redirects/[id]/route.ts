import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { redirectAdminErrorResponse } from "@/lib/api/redirect-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteRedirect, getRedirectAdminDetail, updateRedirect } from "@/services/redirect.service";
import { redirectUpdateSchema } from "@/validation/redirect.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const redirect = await getRedirectAdminDetail(session.user.id, id);
    return NextResponse.json(redirect);
  } catch (error) {
    return redirectAdminErrorResponse(error, "GET /api/admin/seo/redirects/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = redirectUpdateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const redirect = await updateRedirect(session.user.id, id, parsed.data);
    return NextResponse.json(redirect);
  } catch (error) {
    return redirectAdminErrorResponse(error, "PATCH /api/admin/seo/redirects/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteRedirect(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return redirectAdminErrorResponse(error, "DELETE /api/admin/seo/redirects/[id]");
  }
}
