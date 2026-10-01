import { randomBytes } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import type { CouponDiscountType } from "@/generated/prisma/client";
import * as cartRepository from "@/repositories/cart.repository";
import * as couponRepository from "@/repositories/coupon.repository";
import type { CouponWithScope } from "@/repositories/coupon.repository";
import {
  CouponAlreadyAppliedError,
  CouponCustomerLimitExceededError,
  CouponExpiredError,
  CouponInactiveError,
  CouponMinOrderValueNotMetError,
  CouponNotFoundError,
  CouponNotYetActiveError,
  CouponScopeNotMetError,
  CouponUsageLimitExceededError,
} from "@/services/coupon.errors";
import { getCartForCheckout, getCartSummaryById } from "@/services/cart.service";
import type { DiscountableLine, DiscountRule } from "@/services/discount.service";
import { couponToRule, matchingLinesTotal } from "@/services/discount.service";
import type { CartSummary } from "@/types/cart";

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Full, throwing validation — used both by applyCouponToCart (initial
 * apply) and by checkout.service.ts's placeOrder (final re-validation).
 * `guestEmail` is null everywhere except placeOrder, once STORY-025's
 * Address step has collected it — see docs/architecture-decisions.md for
 * why a guest's per-customer limit can only be enforced there, not at
 * cart-apply time.
 */
export async function validateCoupon(
  coupon: CouponWithScope,
  lines: DiscountableLine[],
  subtotal: number,
  userId: string | null,
  guestEmail: string | null,
  now: Date = new Date(),
): Promise<DiscountRule> {
  // STORY-048. A customer-admin-issued coupon (restrictedToUserId set)
  // doesn't exist as far as anyone else is concerned — CouponNotFoundError,
  // not a distinct "forbidden", matching this app's no-enumeration
  // precedent (auth.service.ts::verifyCredentials).
  if (coupon.restrictedToUserId && coupon.restrictedToUserId !== userId) throw new CouponNotFoundError();
  if (!coupon.isActive) throw new CouponInactiveError();
  if (now < coupon.startDate) throw new CouponNotYetActiveError();
  if (now > coupon.endDate) throw new CouponExpiredError();

  if (coupon.usageLimitGlobal !== null) {
    const globalCount = await couponRepository.countGlobalRedemptions(coupon.id);
    if (globalCount >= coupon.usageLimitGlobal) throw new CouponUsageLimitExceededError();
  }

  if (coupon.usageLimitPerCustomer !== null && (userId || guestEmail)) {
    const customerCount = await couponRepository.countCustomerRedemptions(coupon.id, userId, guestEmail);
    if (customerCount >= coupon.usageLimitPerCustomer) throw new CouponCustomerLimitExceededError();
  }

  const minOrderValue = coupon.minOrderValue?.toNumber() ?? null;
  if (minOrderValue !== null && subtotal < minOrderValue) {
    throw new CouponMinOrderValueNotMetError(minOrderValue, round2(minOrderValue - subtotal));
  }

  const rule = couponToRule(coupon);
  if (matchingLinesTotal(rule, lines) <= 0) throw new CouponScopeNotMetError();
  return rule;
}

export interface CouponMutationResult {
  summary: CartSummary;
  /** Set only when a brand-new guest cart was just created by this call — the caller (a route handler) must Set-Cookie this, same as cart.service.ts::addItem. */
  newCookieValue: string | null;
}

export async function applyCouponToCart(
  userId: string | null,
  guestCookieValue: string | null | undefined,
  code: string,
): Promise<CouponMutationResult> {
  const { cart, items, summary, newCookieValue } = await getCartForCheckout(userId, guestCookieValue);

  const coupon = await couponRepository.findCouponByCode(code);
  if (!coupon) throw new CouponNotFoundError();
  if (cart.couponId === coupon.id) throw new CouponAlreadyAppliedError();

  const lines: DiscountableLine[] = items.map((item) => ({
    productId: item.productId,
    categoryIds: item.product.categories.map((category) => category.id),
    lineTotal: item.unitPriceSnapshot.toNumber() * item.quantity,
  }));

  // Guest per-customer limit is intentionally not checked here (no email
  // yet) — everything else is, so a doomed-at-checkout apply is still
  // rejected as early as possible.
  await validateCoupon(coupon, lines, summary.subtotal, userId, null);

  await cartRepository.setCartCoupon(cart.id, coupon.id);
  // Re-read by the already-resolved cart id — never re-run identity
  // resolution from the cookie a second time in the same request, which
  // for a brand-new guest (no cookie yet) would create a SECOND cart.
  return { summary: await getCartSummaryById(cart.id, userId), newCookieValue };
}

export async function removeCouponFromCart(userId: string | null, guestCookieValue: string | null | undefined): Promise<CouponMutationResult> {
  const { cart, newCookieValue } = await getCartForCheckout(userId, guestCookieValue);
  if (cart.couponId) await cartRepository.clearCartCoupon(cart.id);
  return { summary: await getCartSummaryById(cart.id, userId), newCookieValue };
}

// ---------------------------------------------------------------------------
// STORY-048. Customer-admin coupon issuance — referral.service.ts's own
// comment flagged this exact gap ("coupon.repository.ts has no function
// to programmatically create a new Coupon row... building one is
// separate scope") before this story existed to own it. General-purpose
// coupon CRUD (the Marketing console) is still a future story; this is
// only ever a single customer-restricted grant.
// ---------------------------------------------------------------------------

const ISSUED_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ISSUED_CODE_LENGTH = 8;
const ISSUED_CODE_MAX_ATTEMPTS = 5;

function isUniqueCodeViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes("code") : typeof target === "string" && target.includes("code");
}

function generateIssuedCode(): string {
  const bytes = randomBytes(ISSUED_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < ISSUED_CODE_LENGTH; i += 1) code += ISSUED_CODE_ALPHABET[bytes[i] % ISSUED_CODE_ALPHABET.length];
  return code;
}

export interface IssueCouponToCustomerInput {
  discountType: CouponDiscountType;
  percentOff: number | null;
  amountOff: number | null;
  expiresInDays: number;
  /** Maps the AC's "single-use or account-scoped" directly: 1 = single-use, >1 = a capped number of uses — both are already restricted to this one customer via restrictedToUserId. */
  usageLimit: number;
}

export async function issueCouponToCustomer(userId: string, input: IssueCouponToCustomerInput) {
  const now = new Date();
  const endDate = new Date(now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < ISSUED_CODE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await couponRepository.createCoupon({
        code: generateIssuedCode(),
        discountType: input.discountType,
        percentOff: input.percentOff !== null ? input.percentOff.toFixed(2) : null,
        amountOff: input.amountOff !== null ? input.amountOff.toFixed(2) : null,
        startDate: now,
        endDate,
        usageLimitGlobal: input.usageLimit,
        usageLimitPerCustomer: input.usageLimit,
        restrictedToUserId: userId,
      });
    } catch (error) {
      if (!isUniqueCodeViolation(error)) throw error;
    }
  }
  throw new Error("Could not generate a unique coupon code after several attempts");
}
