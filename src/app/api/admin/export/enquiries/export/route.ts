import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportEnquiryErrorResponse } from "@/lib/api/export-enquiry-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { exportEnquiriesCsv } from "@/services/export-enquiry.service";
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
  });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const { status, country, companyName, productsOfInterest, dateFrom, dateTo } = parsed.data;
    const csv = await exportEnquiriesCsv(session.user.id, { status, country, companyName, productsOfInterest, dateFrom, dateTo });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="export-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return exportEnquiryErrorResponse(error, "GET /api/admin/export/enquiries/export");
  }
}
