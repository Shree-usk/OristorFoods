import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

// Nested include, not `product: true` — Prisma only loads a relation's own
// scalar fields on a plain `include`, and cart.service.ts's line-item
// mapping needs the product's primary image (a relation of Product, not a
// scalar) for the thumbnail. Same ordering convention as
// product.repository.ts's findProductDetailBySlug; `take: 1` since a cart
// line only ever shows one thumbnail. `categories` (STORY-029) is needed
// for coupon/promotion category-scope matching in discount.service.ts.
const withProduct = {
  product: {
    include: {
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
      categories: { select: { id: true } },
    },
  },
} satisfies Prisma.CartItemInclude;

export type CartItemWithProduct = Prisma.CartItemGetPayload<{ include: typeof withProduct }>;

export function findCartByUserId(userId: string) {
  return prisma.cart.findUnique({ where: { userId } });
}

export function findCartById(id: string) {
  return prisma.cart.findUnique({ where: { id } });
}

export function findCartByGuestToken(guestToken: string) {
  return prisma.cart.findUnique({ where: { guestToken } });
}

export function createUserCart(userId: string) {
  return prisma.cart.create({ data: { userId } });
}

export function createGuestCart(guestToken: string) {
  return prisma.cart.create({ data: { guestToken } });
}

export function findCartItemById(id: string) {
  return prisma.cartItem.findUnique({ where: { id } });
}

/**
 * Adding a product already in the cart increments its quantity (matching
 * the `@@unique([cartId, productId])` de-dup guard) rather than creating a
 * second row. `unitPriceSnapshot` is always overwritten to the caller's
 * current resolved price — on a first add that's simply the price being
 * recorded; on an increment, cart.service.ts has already re-resolved the
 * live price before calling this, so the snapshot never goes stale here.
 */
export async function upsertCartItem(
  cartId: string,
  productId: string,
  quantityDelta: number,
  unitPriceSnapshot: string,
) {
  const existing = await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId, productId } } });
  if (existing) {
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantityDelta, unitPriceSnapshot },
    });
  }
  return prisma.cartItem.create({
    data: { cartId, productId, quantity: quantityDelta, unitPriceSnapshot },
  });
}

export function updateCartItemQuantity(id: string, quantity: number) {
  return prisma.cartItem.update({ where: { id }, data: { quantity } });
}

export function updateCartItemSnapshot(id: string, unitPriceSnapshot: string) {
  return prisma.cartItem.update({ where: { id }, data: { unitPriceSnapshot } });
}

export function deleteCartItem(id: string) {
  return prisma.cartItem.delete({ where: { id } });
}

export function listCartItemsWithProduct(cartId: string): Promise<CartItemWithProduct[]> {
  return prisma.cartItem.findMany({
    where: { cartId },
    include: withProduct,
    orderBy: { createdAt: "asc" },
  });
}

export function deleteCart(id: string) {
  return prisma.cart.delete({ where: { id } });
}

/** STORY-029. Setting a coupon replaces any previously applied one — a cart holds at most one at a time. */
export function setCartCoupon(cartId: string, couponId: string) {
  return prisma.cart.update({ where: { id: cartId }, data: { couponId } });
}

export function clearCartCoupon(cartId: string) {
  return prisma.cart.update({ where: { id: cartId }, data: { couponId: null } });
}

/** STORY-030. Points redemption is authenticated-only — see rewards.service.ts. */
export function setCartPointsToRedeem(cartId: string, points: number) {
  return prisma.cart.update({ where: { id: cartId }, data: { pointsToRedeem: points } });
}

/**
 * Deletes a guest cart only if its guestToken still matches, and reports
 * whether this call was the one that deleted it. Used to atomically
 * "claim" a guest cart before merging it — a second, concurrent call
 * (e.g. two tabs authenticating at once) matches zero rows and returns
 * false, rather than both calls reading and re-applying the same items.
 */
export async function deleteGuestCartIfMatchesToken(cartId: string, guestToken: string): Promise<boolean> {
  const result = await prisma.cart.deleteMany({ where: { id: cartId, guestToken } });
  return result.count === 1;
}
