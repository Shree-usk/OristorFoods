import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { adminUserAdminErrorResponse } from "@/lib/api/admin-user-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteUser, getUserDetail, updateRole } from "@/services/admin-user-admin.service";
import { updateAdminUserRoleSchema } from "@/validation/admin-user-admin.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await getUserDetail(session.user.id, id));
  } catch (error) {
    return adminUserAdminErrorResponse(error, "GET /api/admin/users/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateAdminUserRoleSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateRole(session.user.id, id, parsed.data.roleId));
  } catch (error) {
    return adminUserAdminErrorResponse(error, "PATCH /api/admin/users/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteUser(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminUserAdminErrorResponse(error, "DELETE /api/admin/users/[id]");
  }
}
