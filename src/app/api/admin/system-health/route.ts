import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { adminUserAdminErrorResponse } from "@/lib/api/admin-user-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getSystemHealth } from "@/services/system-health.service";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getSystemHealth(session.user.id));
  } catch (error) {
    return adminUserAdminErrorResponse(error, "GET /api/admin/system-health");
  }
}
