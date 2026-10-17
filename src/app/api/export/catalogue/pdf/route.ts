import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { generateExportCataloguePdf } from "@/services/export-catalogue.service";
import { exportCataloguePdfRequestSchema } from "@/validation/export-catalogue.schema";

/**
 * Public, unauthenticated — the storefront /export catalogue's "Download
 * catalogue (PDF)" button posts here. Rate-limited like /api/search (an
 * anonymous IP fallback, same header): rendering a PDF with embedded
 * images is real server work, unlike the plain listing GET above it.
 */
const PDF_RATE_LIMIT = { max: 10, windowMs: 60 * 1000 };

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = exportCataloguePdfRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const rateLimitKey = `export-catalogue-pdf:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"}`;
  if (!checkRateLimit(rateLimitKey, PDF_RATE_LIMIT)) {
    return NextResponse.json({ error: "Too many PDF requests. Please try again shortly." }, { status: 429 });
  }

  const pdf = await generateExportCataloguePdf(parsed.data.productIds);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=oristor-export-catalogue.pdf",
    },
  });
}
