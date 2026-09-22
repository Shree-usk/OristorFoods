import { NextResponse } from "next/server";

import { getProductsByIds } from "@/services/product.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 200);

  const items = await getProductsByIds(ids);
  return NextResponse.json({ items }, { status: 200 });
}
