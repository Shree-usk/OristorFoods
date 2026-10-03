import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { adminUserAdminErrorResponse } from "@/lib/api/admin-user-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { updateRolePermissions } from "@/services/role-admin.service";
import { updateRolePermissionsSchema } from "@/validation/role-admin.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateRolePermissionsSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateRolePermissions(session.user.id, id, parsed.data.entries));
  } catch (error) {
    return adminUserAdminErrorResponse(error, "PATCH /api/admin/roles/[id]");
  }
}
