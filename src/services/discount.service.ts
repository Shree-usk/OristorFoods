import * as couponRepository from "@/repositories/coupon.repository";
import type { CouponWithScope, PromotionWithScope } from "@/repositories/coupon.repository";
import type { CouponErrorCode } from "@/services/coupon.errors";

/**
 * Cart-level discount calculation (STORY-029): coupon-code redemption and
 * automatic campaign promotions, composed against the cart's already
 * tier-priced line totals (STORY-009's resolvePrice() has already run by
 * the time a CartLineItem exists — a distributor's coupon discounts
 * their already-discounted total, not the retail price; no special-
 * casing needed, see docs/architecture-decisions.md).
 *
 * `CampaignPrice` (pricing.service.ts, per-product price override) and
 * `Promotion` here (cart-level discount) are related but distinct
 * mechanisms at different layers — do not conflate them.
 *
 * calculateDiscount() is the pure, independently-testable math (mirrors
 * shipping.service.ts's calculateDeliveryCharge/resolveDelivery split).
 * resolveDiscountForCart() is the DB-reading orchestrator both
 * cart.service.ts and checkout.service.ts call.
 */

export type DiscountSourceType = "coupon" | "promotion";
export type DiscountKind = "PercentageOff" | "FixedAmountOff" | "FreeShipping";
export type DiscountScope = "AllProducts" | "Category" | "Product";

export interface DiscountableLine {
  productId: string;
  categoryIds: string[];
  lineTotal: number;
}

export interface DiscountRule {
  sourceType: DiscountSourceType;
  sourceId: string;
  label: string;
  discountType: DiscountKind;
  percentOff: number | null;
  amountOff: number | null;
  scope: DiscountScope;
  scopeProductIds: string[];
  scopeCategoryIds: string[];
  minOrderValue: number | null;
  stackable: boolean;
  /** Tie-break among simultaneously-eligible promotions; a coupon always wins a tie regardless of this value. */
  priority: number;
}

export interface AppliedDiscount {
  sourceType: DiscountSourceType;
  sourceId: string;
  label: string;
  amount: number;
  isFreeShipping: boolean;
}

export interface DiscountResult {
  applied: AppliedDiscount[];
  /** Sum of money-off amounts only — excludes free shipping's waived-delivery value. */
  totalAmount: number;
  freeShippingApplied: boolean;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function matchingLinesTotal(rule: Pick<DiscountRule, "scope" | "scopeProductIds" | "scopeCategoryIds">, lines: DiscountableLine[]): number {
  if (rule.scope === "AllProducts") return lines.reduce((sum, line) => sum + line.lineTotal, 0);
  if (rule.scope === "Product") {
    return lines.filter((line) => rule.scopeProductIds.includes(line.productId)).reduce((sum, line) => sum + line.lineTotal, 0);
  }
  return lines
    .filter((line) => line.categoryIds.some((categoryId) => rule.scopeCategoryIds.includes(categoryId)))
    .reduce((sum, line) => sum + line.lineTotal, 0);
}

/**
 * A FreeShipping rule's comparable "value" is the current delivery charge
 * (0 if delivery is already free from the zone's own threshold — no
 * double-dipping) — this is the only way to compare it against a
 * money-off rule on one scale for take-best/stacking purposes.
 */
function candidateAmount(rule: DiscountRule, lines: DiscountableLine[], deliveryCharge: number): number {
  if (rule.discountType === "FreeShipping") return deliveryCharge;
  const matching = matchingLinesTotal(rule, lines);
  if (matching <= 0) return 0;
  if (rule.discountType === "PercentageOff") return round2(matching * ((rule.percentOff ?? 0) / 100));
  return Math.min(rule.amountOff ?? 0, matching);
}

/** Pure — no DB, no implicit Date.now(). */
export function calculateDiscount(input: {
  lines: DiscountableLine[];
  subtotal: number;
  deliveryCharge: number;
  coupon: DiscountRule | null;
  promotions: DiscountRule[];
}): DiscountResult {
  const candidates: DiscountRule[] = input.coupon ? [input.coupon, ...input.promotions] : [...input.promotions];

  const eligible = candidates
    .filter((rule) => rule.minOrderValue === null || input.subtotal >= rule.minOrderValue)
    .map((rule) => ({ rule, amount: candidateAmount(rule, input.lines, input.deliveryCharge) }))
    .filter((candidate) => candidate.amount > 0);

  if (eligible.length === 0) return { applied: [], totalAmount: 0, freeShippingApplied: false };

  const allStackable = eligible.every((candidate) => candidate.rule.stackable);
  const winners = allStackable && eligible.length > 1 ? eligible : [pickBest(eligible)];

  let moneyTotal = 0;
  let freeShippingApplied = false;
  const applied: AppliedDiscount[] = winners.map((winner) => {
    const isFreeShipping = winner.rule.discountType === "FreeShipping";
    if (isFreeShipping) freeShippingApplied = true;
    else moneyTotal += winner.amount;
    return { sourceType: winner.rule.sourceType, sourceId: winner.rule.sourceId, label: winner.rule.label, amount: winner.amount, isFreeShipping };
  });

  return { applied, totalAmount: Math.min(round2(moneyTotal), input.subtotal), freeShippingApplied };
}

/** Highest amount wins; ties: coupon beats promotion; ties among promotions: lower priority wins. */
function pickBest<T extends { rule: DiscountRule; amount: number }>(candidates: T[]): T {
  return candidates.reduce((best, current) => {
    if (current.amount > best.amount) return current;
    if (current.amount < best.amount) return best;
    if (current.rule.sourceType === "coupon" && best.rule.sourceType !== "coupon") return current;
    if (best.rule.sourceType === "coupon" && current.rule.sourceType !== "coupon") return best;
    return current.rule.priority < best.rule.priority ? current : best;
  });
}

export function couponToRule(coupon: CouponWithScope): DiscountRule {
  return {
    sourceType: "coupon",
    sourceId: coupon.id,
    label: `Coupon ${coupon.code}`,
    discountType: coupon.discountType,
    percentOff: coupon.percentOff?.toNumber() ?? null,
    amountOff: coupon.amountOff?.toNumber() ?? null,
    scope: coupon.scope,
    scopeProductIds: coupon.scopeProducts.map((row) => row.productId),
    scopeCategoryIds: coupon.scopeCategories.map((row) => row.categoryId),
    minOrderValue: coupon.minOrderValue?.toNumber() ?? null,
    stackable: coupon.stackable,
    priority: 0,
  };
}

export function promotionToRule(promotion: PromotionWithScope): DiscountRule {
  return {
    sourceType: "promotion",
    sourceId: promotion.id,
    label: promotion.displayLabel,
    discountType: promotion.discountType,
    percentOff: promotion.percentOff?.toNumber() ?? null,
    amountOff: promotion.amountOff?.toNumber() ?? null,
    scope: promotion.scope,
    scopeProductIds: promotion.scopeProducts.map((row) => row.productId),
    scopeCategoryIds: promotion.scopeCategories.map((row) => row.categoryId),
    minOrderValue: promotion.minOrderValue?.toNumber() ?? null,
    stackable: promotion.stackable,
    priority: promotion.priority,
  };
}

/**
 * Silent-skip eligibility for a passive cart read (never throws) — active
 * window, isActive flag, global usage limit, and (for a known
 * authenticated userId only) the per-customer limit. Guests get no
 * per-customer check here by design (see docs/architecture-decisions.md)
 * — it's only enforced by coupon.service.ts::validateCoupon at apply time
 * and again at placeOrder once an email exists. min-order-value/scope
 * aren't "errors" here, just reasons calculateDiscount naturally returns
 * a $0 contribution for — but are surfaced as a specific reason so the UI
 * can explain why an applied coupon isn't currently contributing.
 */
export async function checkCouponReadEligibility(
  coupon: CouponWithScope,
  subtotal: number,
  lines: DiscountableLine[],
  userId: string | null,
  now: Date,
): Promise<CouponErrorCode | null> {
  if (!coupon.isActive) return "inactive";
  if (now < coupon.startDate) return "not_yet_active";
  if (now > coupon.endDate) return "expired";
  if (coupon.usageLimitGlobal !== null) {
    const globalCount = await couponRepository.countGlobalRedemptions(coupon.id);
    if (globalCount >= coupon.usageLimitGlobal) return "usage_limit_exceeded";
  }
  if (userId && coupon.usageLimitPerCustomer !== null) {
    const customerCount = await couponRepository.countCustomerRedemptions(coupon.id, userId, null);
    if (customerCount >= coupon.usageLimitPerCustomer) return "customer_limit_exceeded";
  }
  const minOrderValue = coupon.minOrderValue?.toNumber() ?? null;
  if (minOrderValue !== null && subtotal < minOrderValue) return "min_order_value_not_met";
  if (matchingLinesTotal(couponToRule(coupon), lines) <= 0) return "scope_not_met";
  return null;
}

export interface ResolvedCartDiscount extends DiscountResult {
  couponCode: string | null;
  couponInvalidReason: CouponErrorCode | null;
}

export async function resolveDiscountForCart(
  cart: { couponId: string | null },
  lines: DiscountableLine[],
  subtotal: number,
  deliveryCharge: number,
  userId: string | null,
  now: Date = new Date(),
): Promise<ResolvedCartDiscount> {
  const promotionRows = await couponRepository.listActivePromotions(now);
  const promotions = promotionRows.map(promotionToRule);

  let couponRule: DiscountRule | null = null;
  let couponCode: string | null = null;
  let couponInvalidReason: CouponErrorCode | null = null;

  if (cart.couponId) {
    const coupon = await couponRepository.findCouponById(cart.couponId);
    if (!coupon) {
      couponInvalidReason = "not_found";
    } else {
      couponCode = coupon.code;
      couponInvalidReason = await checkCouponReadEligibility(coupon, subtotal, lines, userId, now);
      if (!couponInvalidReason) couponRule = couponToRule(coupon);
    }
  }

  const result = calculateDiscount({ lines, subtotal, deliveryCharge, coupon: couponRule, promotions });
  return { ...result, couponCode, couponInvalidReason };
}
