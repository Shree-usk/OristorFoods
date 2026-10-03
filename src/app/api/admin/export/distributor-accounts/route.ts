import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportEnquiryErrorResponse } from "@/lib/api/export-enquiry-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { listDistributorAccounts } from "@/services/export-enquiry.service";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listDistributorAccounts(session.user.id));
  } catch (error) {
    return exportEnquiryErrorResponse(error, "GET /api/admin/export/distributor-accounts");
  }
}
