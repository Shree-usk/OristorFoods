import { NextResponse } from "next/server";

import { getProductDetail } from "@/services/product.service";
import { productSlugParamSchema } from "@/validation/product-detail.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = productSlugParamSchema.parse(await params);

  const product = await getProductDetail(slug);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json(product, { status: 200 });
}
