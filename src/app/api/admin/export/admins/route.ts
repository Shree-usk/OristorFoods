import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportEnquiryErrorResponse } from "@/lib/api/export-enquiry-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { listAssignableAdmins } from "@/services/export-enquiry.service";

/** STORY-058. A minimal admin list for the assignee picker — scoped to ExportPortal:Edit, not UsersRolesAudit:View. */
export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listAssignableAdmins(session.user.id));
  } catch (error) {
    return exportEnquiryErrorResponse(error, "GET /api/admin/export/admins");
  }
}
