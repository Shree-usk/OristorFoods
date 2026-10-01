import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { listProducts } from "@/services/product.service";
import { productListingQuerySchema } from "@/validation/product-listing.schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = Object.fromEntries(url.searchParams);
  const query = productListingQuerySchema.parse(rawQuery);
  const session = await auth();
  const customerGroup = await resolveCustomerGroupForUser(session?.user?.id ?? null);

  const result = await listProducts({
    categorySlug: query.category,
    collectionSlug: query.collection,
    filters: {
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      allergens: query.allergens,
      certifications: query.certifications,
      brands: query.brands,
      inStock: query.inStock,
    },
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
    customerGroup,
  });

  return NextResponse.json(result, { status: 200 });
}
