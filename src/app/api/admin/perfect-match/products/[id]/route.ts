import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { perfectMatchAdminErrorResponse } from "@/lib/api/perfect-match-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getPerfectMatchProductForAdmin, removePerfectMatchProduct, updatePerfectMatchProductAdmin } from "@/services/perfect-match-admin.service";
import { perfectMatchProductAdminSchema } from "@/validation/perfect-match-admin.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await getPerfectMatchProductForAdmin(session.user.id, id));
  } catch (error) {
    return perfectMatchAdminErrorResponse(error, "GET /api/admin/perfect-match/products/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = perfectMatchProductAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updatePerfectMatchProductAdmin(session.user.id, id, parsed.data));
  } catch (error) {
    return perfectMatchAdminErrorResponse(error, "PATCH /api/admin/perfect-match/products/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await removePerfectMatchProduct(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return perfectMatchAdminErrorResponse(error, "DELETE /api/admin/perfect-match/products/[id]");
  }
}
