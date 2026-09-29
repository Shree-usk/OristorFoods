import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cartErrorResponse } from "@/lib/api/cart-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { applyPointsToCart, removePointsFromCart } from "@/services/rewards.service";
import { redeemPointsSchema } from "@/validation/rewards.schema";

/**
 * Redemption is authenticated-only (STORY-030) — a guest has no ledger to
 * redeem from. applyPointsToCart/removePointsFromCart already throw
 * RewardsNotAuthenticatedError for a null userId, mapped to 401 by
 * cartErrorResponse, so no separate auth check is needed here.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = redeemPointsSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const summary = await applyPointsToCart(userId, parsed.data.points);
    return NextResponse.json(summary);
  } catch (error) {
    return cartErrorResponse(error);
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const summary = await removePointsFromCart(userId);
    return NextResponse.json(summary);
  } catch (error) {
    return cartErrorResponse(error);
  }
}
