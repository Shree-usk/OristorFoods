import { NextResponse } from "next/server";

import { listExportCatalogueProducts } from "@/services/export-catalogue.service";
import { exportCatalogueProductsQuerySchema } from "@/validation/export-catalogue.schema";

/** Public, unauthenticated — the storefront /export catalogue grid fetches this directly. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = exportCatalogueProductsQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const result = await listExportCatalogueProducts(parsed.data);
  return NextResponse.json(result, { status: 200 });
}
