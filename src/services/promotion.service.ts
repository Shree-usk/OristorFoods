import * as couponRepository from "@/repositories/coupon.repository";
import type { DiscountableLine, DiscountRule } from "@/services/discount.service";
import { matchingLinesTotal, promotionToRule } from "@/services/discount.service";

export interface EligiblePromotion {
  rule: DiscountRule;
  /** Money value of the matching cart lines this promotion could discount — the actual applied amount (after stacking/take-best against a coupon) is decided by discount.service.ts::calculateDiscount, not here. */
  matchingLinesTotal: number;
}

/**
 * Active, scope-eligible promotions for a cart — read-only, no
 * persistence (a Promotion is never "applied" to a Cart row like a
 * Coupon; it's evaluated fresh on every call, since by definition it
 * requires no customer action). Callers wanting the final applied
 * discount (with coupon precedence resolved) should go through
 * discount.service.ts::resolveDiscountForCart instead — this function is
 * for read-only listing/reporting use cases, so it deliberately doesn't
 * duplicate the stacking/take-best algorithm.
 */
export async function evaluatePromotionsForCart(
  lines: DiscountableLine[],
  subtotal: number,
  now: Date = new Date(),
): Promise<EligiblePromotion[]> {
  const promotions = await couponRepository.listActivePromotions(now);
  return promotions
    .map((promotion) => promotionToRule(promotion))
    .filter((rule) => rule.minOrderValue === null || subtotal >= rule.minOrderValue)
    .map((rule) => ({ rule, matchingLinesTotal: matchingLinesTotal(rule, lines) }))
    .filter((candidate) => candidate.matchingLinesTotal > 0);
}
