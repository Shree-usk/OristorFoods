import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const withProduct = { product: true } satisfies Prisma.CartItemInclude;

export type CartItemWithProduct = Prisma.CartItemGetPayload<{ include: typeof withProduct }>;

export function findCartByUserId(userId: string) {
  return prisma.cart.findUnique({ where: { userId } });
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
