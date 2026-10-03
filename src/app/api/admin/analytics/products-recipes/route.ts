import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { analyticsErrorResponse } from "@/lib/api/analytics-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { exportProductsRecipesReportCsv, exportProductsRecipesReportPdf, getProductsRecipesReport } from "@/services/analytics.service";
import { analyticsQuerySchema } from "@/validation/analytics.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const url = new URL(request.url);
  const parsed = analyticsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const query = parsed.data;

  try {
    if (query.format === "csv") {
      const csv = await exportProductsRecipesReportCsv(session.user.id, query);
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${query.metric}-report.csv"` } });
    }
    if (query.format === "pdf") {
      const buffer = await exportProductsRecipesReportPdf(session.user.id, query);
      return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${query.metric}-report.pdf"` } });
    }
    return NextResponse.json(await getProductsRecipesReport(session.user.id, query));
  } catch (error) {
    return analyticsErrorResponse(error, "GET /api/admin/analytics/products-recipes");
  }
}
