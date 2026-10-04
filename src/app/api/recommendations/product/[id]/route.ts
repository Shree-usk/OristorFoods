import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { serverErrorResponse } from "@/lib/api/responses";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { getSimilarProducts, getFrequentlyBoughtTogether } from "@/services/recommendation.service";
import { findProductCategoryIds } from "@/repositories/product.repository";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const categoryIds = await findProductCategoryIds(id);
    if (categoryIds === null) return NextResponse.json({ similar: [], frequentlyBoughtTogether: [] });

    const session = await auth();
    const customerGroup = await resolveCustomerGroupForUser(session?.user?.id ?? null);

    const [similar, frequentlyBoughtTogether] = await Promise.all([
      getSimilarProducts({ productId: id, categoryIds, customerGroup }),
      getFrequentlyBoughtTogether({ productId: id, customerGroup }),
    ]);
    return NextResponse.json({ similar, frequentlyBoughtTogether });
  } catch (error) {
    return serverErrorResponse(error, "GET /api/recommendations/product/[id]");
  }
}
