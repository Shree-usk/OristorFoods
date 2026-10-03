import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { systemSettingsErrorResponse } from "@/lib/api/system-settings-responses";
import { listTemplatesForAdmin } from "@/services/notification-template-admin.service";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listTemplatesForAdmin(session.user.id));
  } catch (error) {
    return systemSettingsErrorResponse(error, "GET /api/admin/settings/notification-templates");
  }
}
