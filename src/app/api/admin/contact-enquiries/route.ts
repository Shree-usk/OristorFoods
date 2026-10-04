import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { contactEnquiryErrorResponse } from "@/lib/api/contact-enquiry-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listEnquiries } from "@/services/contact-enquiry.service";
import { contactEnquiryFiltersSchema } from "@/validation/contact-enquiry.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const url = new URL(request.url);
  const parsed = contactEnquiryFiltersSchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    enquiryType: url.searchParams.get("enquiryType") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { page, ...filters } = parsed.data;
  try {
    return NextResponse.json(await listEnquiries(session.user.id, filters, page ?? 1));
  } catch (error) {
    return contactEnquiryErrorResponse(error, "GET /api/admin/contact-enquiries");
  }
}
