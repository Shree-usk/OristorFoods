import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { adminUserAdminErrorResponse } from "@/lib/api/admin-user-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { cloneRole } from "@/services/role-admin.service";
import { cloneRoleSchema } from "@/validation/role-admin.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = cloneRoleSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const role = await cloneRole(session.user.id, parsed.data);
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return adminUserAdminErrorResponse(error, "POST /api/admin/roles/clone");
  }
}
