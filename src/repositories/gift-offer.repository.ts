import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** The only place GiftOffer/GiftOfferRedemption are queried/mutated (Story 5 — Free Gift). */

const withGiftProductAndQualifier = {
  product: { select: { id: true, name: true, slug: true } },
  giftProduct: { include: { images: { where: { isPrimary: true }, take: 1 } } },
  giftVariant: true,
} satisfies Prisma.GiftOfferInclude;

export type GiftOfferWithProducts = Prisma.GiftOfferGetPayload<{ include: typeof withGiftProductAndQualifier }>;

export function findGiftOfferById(id: string): Promise<GiftOfferWithProducts | null> {
  return prisma.giftOffer.findUnique({ where: { id }, include: withGiftProductAndQualifier });
}

/** The PDP-read path — a product has at most one gift offer, like ProductBundle.productId. */
export function findGiftOfferByProductId(productId: string): Promise<GiftOfferWithProducts | null> {
  return prisma.giftOffer.findUnique({ where: { productId }, include: withGiftProductAndQualifier });
}

export function listGiftOffersForAdmin(): Promise<GiftOfferWithProducts[]> {
  return prisma.giftOffer.findMany({ include: withGiftProductAndQualifier, orderBy: { createdAt: "desc" } });
}

export function createGiftOffer(data: Prisma.GiftOfferCreateInput): Promise<GiftOfferWithProducts> {
  return prisma.giftOffer.create({ data, include: withGiftProductAndQualifier });
}

export function updateGiftOffer(id: string, data: Prisma.GiftOfferUpdateInput): Promise<GiftOfferWithProducts> {
  return prisma.giftOffer.update({ where: { id }, data, include: withGiftProductAndQualifier });
}

export function countRedemptions(giftOfferId: string): Promise<number> {
  return prisma.giftOfferRedemption.count({ where: { giftOfferId } });
}

/** userId for an authenticated customer, guestEmail (case-insensitive) for a guest — never both. */
export function countCustomerRedemptions(giftOfferId: string, userId: string | null, guestEmail: string | null): Promise<number> {
  if (userId) return prisma.giftOfferRedemption.count({ where: { giftOfferId, userId } });
  if (guestEmail) return prisma.giftOfferRedemption.count({ where: { giftOfferId, guestEmail: { equals: guestEmail, mode: "insensitive" } } });
  return Promise.resolve(0);
}

export interface CreateGiftRedemptionInput {
  giftOfferId: string;
  userId: string | null;
  guestEmail: string | null;
  orderId: string;
}

/**
 * Called ONLY from inside order.repository.ts's order-creation transaction
 * (`tx`) — never standalone — so a rollback (e.g. insufficient stock) can
 * never leave an orphaned redemption row. Mirrors coupon.repository.ts's
 * own createRedemption exactly.
 */
export function createRedemption(tx: Prisma.TransactionClient, input: CreateGiftRedemptionInput) {
  return tx.giftOfferRedemption.create({ data: input });
}
