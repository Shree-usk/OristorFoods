import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { serverErrorResponse, validationErrorResponse } from "@/lib/api/responses";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { getCartCrossSell } from "@/services/recommendation.service";
import { cartRecommendationsSchema } from "@/validation/recommendation.schema";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = cartRecommendationsSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const customerGroup = await resolveCustomerGroupForUser(session?.user?.id ?? null);
    const products = await getCartCrossSell({ productIds: parsed.data.productIds, customerGroup });
    return NextResponse.json({ products });
  } catch (error) {
    return serverErrorResponse(error, "POST /api/recommendations/cart");
  }
}
