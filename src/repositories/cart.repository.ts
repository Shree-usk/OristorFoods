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
  variant: { include: { images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 } } },
  // Story 2 (Bundles). Just the bundle's own display name — full
  // definition re-validation reads bundle.repository.ts's own richer
  // include separately (bundle.service.ts::resolveBundleInstancePrices),
  // never this one.
  bundle: { select: { name: true } },
  // Story 3 (Custom Packaging). The full row (+ its method) — unlike a
  // bundle instance, a packaging option's eligibility depends only on its
  // own fields, so packaging.service.ts::resolvePackagingForCartItems
  // re-validates straight off this include with no second query.
  packagingOption: { include: { packagingMethod: true } },
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
  // Story 3: includes the pinned packaging option's minQuantity — needed
  // by cart.service.ts::updateItemQuantity's synchronous MOQ guard.
  return prisma.cartItem.findUnique({ where: { id }, include: { packagingOption: { select: { minQuantity: true } } } });
}

/**
 * Adding a product (and, if given, a specific variant of it) already in
 * the cart increments its quantity (matching the
 * `@@unique([cartId, productId, variantId, bundleInstanceId])` de-dup
 * guard) rather than creating a second row. A null `variantId` only
 * matches another row that's also variant-less — two different sizes of
 * the same product are independent rows, never merged. `unitPriceSnapshot`
 * is always overwritten to the caller's current resolved price — on a
 * first add that's simply the price being recorded; on an increment,
 * cart.service.ts has already re-resolved the live price before calling
 * this, so the snapshot never goes stale here.
 *
 * `bundle` (Story 2) tags every row exploded from one "add bundle to
 * cart" action with the same bundleInstanceId, which is part of the
 * lookup below — this is what stops two different bundle instances that
 * happen to share a component product/variant from merging into each
 * other's quantity. Omitted (both null) for a plain line, matching every
 * row that existed before bundles shipped.
 */
export async function upsertCartItem(
  cartId: string,
  productId: string,
  variantId: string | null,
  quantityDelta: number,
  unitPriceSnapshot: string,
  bundle: { bundleId: string; bundleInstanceId: string } | null = null,
  packaging: { packagingOptionId: string; declaredAvailability: "Local" | "Export"; chargeSnapshot: string } | null = null,
) {
  // findFirst, not findUnique: Prisma's generated compound-unique input
  // for a compound key with nullable members types them as non-nullable
  // even though the columns are nullable (a known Prisma typing gotcha),
  // so a plain `where` filter is used instead — still a single-row
  // lookup backed by the same unique index at the DB level.
  const existing = await prisma.cartItem.findFirst({
    where: { cartId, productId, variantId, bundleInstanceId: bundle?.bundleInstanceId ?? null, packagingOptionId: packaging?.packagingOptionId ?? null },
  });
  if (existing) {
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantityDelta, unitPriceSnapshot },
    });
  }
  return prisma.cartItem.create({
    data: {
      cartId,
      productId,
      variantId,
      quantity: quantityDelta,
      unitPriceSnapshot,
      bundleId: bundle?.bundleId ?? null,
      bundleInstanceId: bundle?.bundleInstanceId ?? null,
      packagingOptionId: packaging?.packagingOptionId ?? null,
      packagingDeclaredAvailability: packaging?.declaredAvailability ?? null,
      packagingChargeSnapshot: packaging?.chargeSnapshot ?? null,
    },
  });
}

/** All exploded rows of one bundle instance — used to remove/validate ownership of a whole bundle group at once. */
export function listBundleInstanceItems(cartId: string, bundleInstanceId: string) {
  return prisma.cartItem.findMany({ where: { cartId, bundleInstanceId } });
}

export async function deleteBundleInstance(cartId: string, bundleInstanceId: string): Promise<void> {
  await prisma.cartItem.deleteMany({ where: { cartId, bundleInstanceId } });
}

export function updateCartItemQuantity(id: string, quantity: number) {
  return prisma.cartItem.update({ where: { id }, data: { quantity } });
}

export function updateCartItemSnapshot(id: string, unitPriceSnapshot: string) {
  return prisma.cartItem.update({ where: { id }, data: { unitPriceSnapshot } });
}

/** Story 3. Re-snapshots a live packaging-charge change, mirroring updateCartItemSnapshot's own re-price convention. */
export function updateCartItemPackagingChargeSnapshot(id: string, packagingChargeSnapshot: string) {
  return prisma.cartItem.update({ where: { id }, data: { packagingChargeSnapshot } });
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
