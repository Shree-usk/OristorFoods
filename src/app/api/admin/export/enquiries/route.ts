import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportEnquiryErrorResponse } from "@/lib/api/export-enquiry-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listEnquiries } from "@/services/export-enquiry.service";
import { exportEnquiryFiltersSchema } from "@/validation/export-enquiry.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const url = new URL(request.url);
  const parsed = exportEnquiryFiltersSchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
    companyName: url.searchParams.get("companyName") ?? undefined,
    productsOfInterest: url.searchParams.get("productsOfInterest") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { page, ...filters } = parsed.data;
  try {
    return NextResponse.json(await listEnquiries(session.user.id, filters, page ?? 1));
  } catch (error) {
    return exportEnquiryErrorResponse(error, "GET /api/admin/export/enquiries");
  }
}
