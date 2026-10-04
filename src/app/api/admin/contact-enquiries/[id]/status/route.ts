import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { contactEnquiryErrorResponse } from "@/lib/api/contact-enquiry-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { updateStatus } from "@/services/contact-enquiry.service";
import { updateContactEnquiryStatusSchema } from "@/validation/contact-enquiry.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateContactEnquiryStatusSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateStatus(session.user.id, id, parsed.data.status));
  } catch (error) {
    return contactEnquiryErrorResponse(error, "POST /api/admin/contact-enquiries/[id]/status");
  }
}
