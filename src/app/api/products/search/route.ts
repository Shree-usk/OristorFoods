import { NextResponse } from "next/server";

import { searchProducts } from "@/services/search.service";
import { productSearchQuerySchema } from "@/validation/product-search.schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = Object.fromEntries(url.searchParams);
  const query = productSearchQuerySchema.parse(rawQuery);

  const result = await searchProducts(query.q, {
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
    filters: {
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      allergens: query.allergens,
      certifications: query.certifications,
      brands: query.brands,
      inStock: query.inStock,
    },
  });

  return NextResponse.json(result, { status: 200 });
}
