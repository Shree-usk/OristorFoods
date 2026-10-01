import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { getProductsByIds } from "@/services/product.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 200);

  const session = await auth();
  const customerGroup = await resolveCustomerGroupForUser(session?.user?.id ?? null);
  const items = await getProductsByIds(ids, customerGroup);
  return NextResponse.json({ items }, { status: 200 });
}
