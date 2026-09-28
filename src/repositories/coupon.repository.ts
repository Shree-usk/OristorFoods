import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * The only place Coupon/CouponRedemption/Promotion (+ their scope join
 * tables) are queried/mutated.
 */

const withCouponScope = {
  scopeProducts: { select: { productId: true } },
  scopeCategories: { select: { categoryId: true } },
} satisfies Prisma.CouponInclude;

export type CouponWithScope = Prisma.CouponGetPayload<{ include: typeof withCouponScope }>;

const withPromotionScope = {
  scopeProducts: { select: { productId: true } },
  scopeCategories: { select: { categoryId: true } },
} satisfies Prisma.PromotionInclude;

export type PromotionWithScope = Prisma.PromotionGetPayload<{ include: typeof withPromotionScope }>;

export function findCouponByCode(code: string): Promise<CouponWithScope | null> {
  return prisma.coupon.findUnique({ where: { code }, include: withCouponScope });
}

export function findCouponById(id: string): Promise<CouponWithScope | null> {
  return prisma.coupon.findUnique({ where: { id }, include: withCouponScope });
}

export function listActivePromotions(now: Date): Promise<PromotionWithScope[]> {
  return prisma.promotion.findMany({
    where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
    include: withPromotionScope,
  });
}

export function countGlobalRedemptions(couponId: string): Promise<number> {
  return prisma.couponRedemption.count({ where: { couponId } });
}

/** userId for an authenticated customer, guestEmail (case-insensitive) for a guest — never both. */
export function countCustomerRedemptions(couponId: string, userId: string | null, guestEmail: string | null): Promise<number> {
  if (userId) return prisma.couponRedemption.count({ where: { couponId, userId } });
  if (guestEmail) return prisma.couponRedemption.count({ where: { couponId, guestEmail: { equals: guestEmail, mode: "insensitive" } } });
  return Promise.resolve(0);
}

export interface CreateRedemptionInput {
  couponId: string;
  userId: string | null;
  guestEmail: string | null;
  orderId: string;
  discountAmount: string;
}

/**
 * Called ONLY from inside order.repository.ts's order-creation
 * transaction (`tx`) — never standalone — so a rollback (e.g.
 * insufficient stock) can never leave an orphaned redemption row.
 */
export function createRedemption(tx: Prisma.TransactionClient, input: CreateRedemptionInput) {
  return tx.couponRedemption.create({ data: input });
}
