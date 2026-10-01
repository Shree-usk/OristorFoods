import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { getProductsForCompare } from "@/services/product.service";
import { compareIdsSchema } from "@/validation/product-compare.schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = compareIdsSchema.safeParse(url.searchParams.get("ids") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid ids" }, { status: 400 });
  }

  const session = await auth();
  const customerGroup = await resolveCustomerGroupForUser(session?.user?.id ?? null);
  const items = await getProductsForCompare(parsed.data, customerGroup);
  return NextResponse.json({ items }, { status: 200 });
}
