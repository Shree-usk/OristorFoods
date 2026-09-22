import { NextResponse } from "next/server";

import { getProductsForCompare } from "@/services/product.service";
import { compareIdsSchema } from "@/validation/product-compare.schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = compareIdsSchema.safeParse(url.searchParams.get("ids") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid ids" }, { status: 400 });
  }

  const items = await getProductsForCompare(parsed.data);
  return NextResponse.json({ items }, { status: 200 });
}
