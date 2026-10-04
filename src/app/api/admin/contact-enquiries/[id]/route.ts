import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { contactEnquiryErrorResponse } from "@/lib/api/contact-enquiry-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getEnquiry } from "@/services/contact-enquiry.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await getEnquiry(session.user.id, id));
  } catch (error) {
    return contactEnquiryErrorResponse(error, "GET /api/admin/contact-enquiries/[id]");
  }
}
