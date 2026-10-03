import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { adminUserAdminErrorResponse } from "@/lib/api/admin-user-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { listRolesWithPermissions } from "@/services/role-admin.service";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listRolesWithPermissions(session.user.id));
  } catch (error) {
    return adminUserAdminErrorResponse(error, "GET /api/admin/roles");
  }
}
