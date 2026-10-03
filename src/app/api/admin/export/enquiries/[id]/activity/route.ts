import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportEnquiryErrorResponse } from "@/lib/api/export-enquiry-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getEnquiryActivity } from "@/services/export-enquiry.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await getEnquiryActivity(session.user.id, id));
  } catch (error) {
    return exportEnquiryErrorResponse(error, "GET /api/admin/export/enquiries/[id]/activity");
  }
}
