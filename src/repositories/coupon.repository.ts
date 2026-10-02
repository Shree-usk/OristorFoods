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

/** STORY-050b. Admin console list — excludes STORY-048's customer-restricted coupons (restrictedToUserId set), which are managed from the Customers console, not here. */
export function listCouponsForAdmin(): Promise<CouponWithScope[]> {
  return prisma.coupon.findMany({ where: { restrictedToUserId: null }, include: withCouponScope, orderBy: { createdAt: "desc" } });
}

export function listPromotionsForAdmin(): Promise<PromotionWithScope[]> {
  return prisma.promotion.findMany({ include: withPromotionScope, orderBy: { createdAt: "desc" } });
}

export function findPromotionById(id: string): Promise<PromotionWithScope | null> {
  return prisma.promotion.findUnique({ where: { id }, include: withPromotionScope });
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

export interface CreateCouponInput {
  code: string;
  discountType: Prisma.CouponCreateInput["discountType"];
  percentOff: string | null;
  amountOff: string | null;
  startDate: Date;
  endDate: Date;
  usageLimitGlobal: number | null;
  usageLimitPerCustomer: number | null;
  restrictedToUserId: string | null;
  // STORY-050b. Optional — omitted by STORY-048's customer-issuance call
  // site, which keeps today's exact AllProducts/no-minimum/non-stackable
  // behavior via these defaults.
  minOrderValue?: string | null;
  scope?: Prisma.CouponCreateInput["scope"];
  stackable?: boolean;
  scopeProductIds?: string[];
  scopeCategoryIds?: string[];
}

/** STORY-048 (customer-admin single-coupon issuance), extended STORY-050b (general-purpose admin coupon CRUD) — the same creation path serves both rather than a parallel function. */
export function createCoupon(input: CreateCouponInput) {
  const { scopeProductIds = [], scopeCategoryIds = [], minOrderValue = null, scope = "AllProducts", stackable = false, ...rest } = input;
  return prisma.coupon.create({
    data: {
      ...rest,
      minOrderValue,
      scope,
      stackable,
      scopeProducts: { create: scopeProductIds.map((productId) => ({ productId })) },
      scopeCategories: { create: scopeCategoryIds.map((categoryId) => ({ categoryId })) },
    },
    include: withCouponScope,
  });
}

export interface UpdateCouponInput {
  discountType?: Prisma.CouponCreateInput["discountType"];
  percentOff?: string | null;
  amountOff?: string | null;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  minOrderValue?: string | null;
  usageLimitGlobal?: number | null;
  usageLimitPerCustomer?: number | null;
  scope?: Prisma.CouponCreateInput["scope"];
  stackable?: boolean;
  isActive?: boolean;
  scopeProductIds?: string[];
  scopeCategoryIds?: string[];
}

/** Replaces the scope join rows wholesale when provided — the standard Prisma "replace a join table" shape (deleteMany + createMany), same as every other admin scope-editing flow in this app. */
export function updateCoupon(id: string, input: UpdateCouponInput) {
  const { scopeProductIds, scopeCategoryIds, ...rest } = input;
  return prisma.coupon.update({
    where: { id },
    data: {
      ...rest,
      ...(scopeProductIds !== undefined && { scopeProducts: { deleteMany: {}, create: scopeProductIds.map((productId) => ({ productId })) } }),
      ...(scopeCategoryIds !== undefined && { scopeCategories: { deleteMany: {}, create: scopeCategoryIds.map((categoryId) => ({ categoryId })) } }),
    },
    include: withCouponScope,
  });
}

export interface CreatePromotionInput {
  name: string;
  displayLabel: string;
  discountType: Prisma.PromotionCreateInput["discountType"];
  percentOff: string | null;
  amountOff: string | null;
  startDate: Date;
  endDate: Date;
  minOrderValue: string | null;
  scope: Prisma.PromotionCreateInput["scope"];
  stackable: boolean;
  priority: number;
  scopeProductIds: string[];
  scopeCategoryIds: string[];
}

export function createPromotion(input: CreatePromotionInput) {
  const { scopeProductIds, scopeCategoryIds, ...rest } = input;
  return prisma.promotion.create({
    data: {
      ...rest,
      scopeProducts: { create: scopeProductIds.map((productId) => ({ productId })) },
      scopeCategories: { create: scopeCategoryIds.map((categoryId) => ({ categoryId })) },
    },
    include: withPromotionScope,
  });
}

export interface UpdatePromotionInput {
  name?: string;
  displayLabel?: string;
  discountType?: Prisma.PromotionCreateInput["discountType"];
  percentOff?: string | null;
  amountOff?: string | null;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  minOrderValue?: string | null;
  scope?: Prisma.PromotionCreateInput["scope"];
  stackable?: boolean;
  priority?: number;
  isActive?: boolean;
  scopeProductIds?: string[];
  scopeCategoryIds?: string[];
}

export function updatePromotion(id: string, input: UpdatePromotionInput) {
  const { scopeProductIds, scopeCategoryIds, ...rest } = input;
  return prisma.promotion.update({
    where: { id },
    data: {
      ...rest,
      ...(scopeProductIds !== undefined && { scopeProducts: { deleteMany: {}, create: scopeProductIds.map((productId) => ({ productId })) } }),
      ...(scopeCategoryIds !== undefined && { scopeCategories: { deleteMany: {}, create: scopeCategoryIds.map((categoryId) => ({ categoryId })) } }),
    },
    include: withPromotionScope,
  });
}
