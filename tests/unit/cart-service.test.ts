// tests/unit/cart-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { verifyCartCookieValue } from "@/lib/cart-token";
import { createBundle, createBundleItem } from "@/repositories/bundle.repository";
import { createProduct } from "@/repositories/product.repository";
import { addBundleToCart, removeBundleFromCart } from "@/services/bundle.service";
import {
  BundleLineLockedError,
  CartItemForbiddenError,
  CartItemNotFoundError,
  GiftLineLockedError,
  PackagingAvailabilityMismatchError,
  PackagingMinimumQuantityError,
  PackagingMinimumWeightError,
  ProductUnavailableError,
  StockExceededError,
} from "@/services/cart.errors";
import { addGiftToCart, removeGiftFromCart } from "@/services/gift-offer.service";
import {
  addItem,
  getCart,
  mergeGuestCartIntoUser,
  removeItem,
  resolveCartIdentity,
  updateItemQuantity,
} from "@/services/cart.service";

let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `cart-svc-${sequence}@test.com` } });
}

async function makeProduct(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  const product = await createProduct({
    sku: `CART-SVC-SKU-${sequence}`,
    slug: `cart-svc-product-${sequence}`,
    name: `Cart Svc Product ${sequence}`,
    status: "Published",
    stockQuantity: 10,
    images: { create: [{ url: "/images/products/export/curry-powder.webp", altText: "Test", sortOrder: 0, isPrimary: true }] },
    ...overrides,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price: "25.00" } });
  return product;
}

async function makeVariant(productId: string, overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return prisma.productVariant.create({
    data: {
      productId,
      sku: `CART-SVC-VARIANT-SKU-${sequence}`,
      name: "100g",
      netWeightGrams: 100,
      price: "30.00",
      currency: "LKR",
      stockQuantity: 10,
      isActive: true,
      inStock: true,
      ...overrides,
    },
  });
}

/** Story 3 (Custom Packaging). */
async function makePackagingOption(productId: string, overrides: Record<string, unknown> = {}) {
  sequence += 1;
  const method = await prisma.packagingMethod.create({ data: { name: `Cart Svc Packaging Method ${sequence}` } });
  return prisma.productPackagingOption.create({ data: { productId, packagingMethodId: method.id, charge: "15.00", ...overrides } });
}

afterEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.giftOfferRedemption.deleteMany();
  await prisma.giftOffer.deleteMany();
  await prisma.bundleItem.deleteMany();
  await prisma.productBundle.deleteMany();
  await prisma.productPackagingOption.deleteMany({ where: { packagingMethod: { name: { startsWith: "Cart Svc Packaging Method " } } } });
  await prisma.packagingMethod.deleteMany({ where: { name: { startsWith: "Cart Svc Packaging Method " } } });
  await prisma.standardPrice.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany({ where: { sku: { startsWith: "CART-SVC-VARIANT-SKU-" } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: "CART-SVC-SKU-" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "cart-svc-" } } });
});

async function makeFixedBundle(components: { product: { id: string }; quantity: number }[], overrides: Record<string, unknown> = {}) {
  sequence += 1;
  const bundleProduct = await createProduct({
    sku: `CART-SVC-SKU-BUNDLE-${sequence}`,
    slug: `cart-svc-bundle-${sequence}`,
    name: `Cart Svc Bundle ${sequence}`,
    status: "Published",
    productType: "Bundle",
  });
  const bundle = await createBundle({ product: { connect: { id: bundleProduct.id } }, bundleType: "Fixed", name: "Fixed Bundle", ...overrides });
  for (const component of components) {
    await createBundleItem({ bundle: { connect: { id: bundle.id } }, componentProduct: { connect: { id: component.product.id } }, quantity: component.quantity });
  }
  return bundle;
}

/** Story 5 (Free Gift). */
async function makeGiftOffer(
  qualifyingProduct: { id: string },
  giftProduct: { id: string },
  overrides: Record<string, unknown> = {},
) {
  sequence += 1;
  return prisma.giftOffer.create({
    data: {
      product: { connect: { id: qualifyingProduct.id } },
      name: `Cart Svc Gift Offer ${sequence}`,
      giftProduct: { connect: { id: giftProduct.id } },
      ...overrides,
    },
  });
}

describe("resolveCartIdentity", () => {
  it("creates a new guest cart and returns a cookie value when the caller has no session and no cookie", async () => {
    const { cart, newCookieValue } = await resolveCartIdentity(null, undefined);
    expect(cart.guestToken).not.toBeNull();
    expect(newCookieValue).not.toBeNull();
  });

  it("reuses an existing guest cart for a valid cookie, issuing no new cookie", async () => {
    const first = await resolveCartIdentity(null, undefined);
    const second = await resolveCartIdentity(null, first.newCookieValue ?? undefined);
    expect(second.cart.id).toBe(first.cart.id);
    expect(second.newCookieValue).toBeNull();
  });

  it("treats a tampered cookie as no guest cart and creates a fresh one", async () => {
    const { cart: original } = await resolveCartIdentity(null, undefined);
    const { cart: fresh } = await resolveCartIdentity(null, "tampered.cookie-value");
    expect(fresh.id).not.toBe(original.id);
  });

  it("creates a new cart for an authenticated user with none yet", async () => {
    const user = await makeUser();
    const { cart, newCookieValue } = await resolveCartIdentity(user.id, undefined);
    expect(cart.userId).toBe(user.id);
    expect(newCookieValue).toBeNull();
  });

  it("reuses an authenticated user's existing cart", async () => {
    const user = await makeUser();
    const first = await resolveCartIdentity(user.id, undefined);
    const second = await resolveCartIdentity(user.id, undefined);
    expect(second.cart.id).toBe(first.cart.id);
  });
});

describe("addItem / getCart", () => {
  it("adds a product and the cart summary reflects price, quantity, and reward points", async () => {
    const user = await makeUser();
    const product = await makeProduct({ rewardPoints: 5 });

    await addItem(user.id, null, product.id, 2);
    const summary = await getCart(user.id, null);

    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]).toMatchObject({ productId: product.id, quantity: 2, unitPrice: 25, lineTotal: 50 });
    expect(summary.itemCount).toBe(2);
    expect(summary.subtotal).toBe(50);
    expect(summary.rewardPointsEarned).toBe(10);
  });

  it("adding the same product twice combines quantity into one line", async () => {
    const user = await makeUser();
    const product = await makeProduct();

    await addItem(user.id, null, product.id, 1);
    await addItem(user.id, null, product.id, 2);
    const summary = await getCart(user.id, null);

    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]?.quantity).toBe(3);
  });

  it("rejects adding more than stockQuantity", async () => {
    const user = await makeUser();
    const product = await makeProduct({ stockQuantity: 3 });

    await expect(addItem(user.id, null, product.id, 5)).rejects.toThrow(StockExceededError);
  });

  it("rejects adding a non-Published product", async () => {
    const user = await makeUser();
    const product = await makeProduct({ status: "Draft" });

    await expect(addItem(user.id, null, product.id, 1)).rejects.toThrow(ProductUnavailableError);
  });

  it("works identically for a guest identity (no userId)", async () => {
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const summary = await getCart(null, newCookieValue ?? undefined);
    expect(summary.items).toHaveLength(1);
  });

  it("rejects adding a product marked inStock: false, even when stockQuantity is positive", async () => {
    const user = await makeUser();
    const product = await makeProduct({ inStock: false, stockQuantity: 50 });

    await expect(addItem(user.id, null, product.id, 1)).rejects.toThrow(ProductUnavailableError);
  });
});

describe("addItem — variants", () => {
  it("adding two different sizes of the same product creates two independent cart lines", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const small = await makeVariant(product.id, { name: "100g", price: "30.00" });
    const large = await makeVariant(product.id, { name: "350g", price: "80.00" });

    await addItem(user.id, null, product.id, 2, small.id);
    await addItem(user.id, null, product.id, 1, large.id);
    const summary = await getCart(user.id, null);

    expect(summary.items).toHaveLength(2);
    const smallLine = summary.items.find((item) => item.variantId === small.id);
    const largeLine = summary.items.find((item) => item.variantId === large.id);
    expect(smallLine).toMatchObject({ quantity: 2, unitPrice: 30, variantName: "100g" });
    expect(largeLine).toMatchObject({ quantity: 1, unitPrice: 80, variantName: "350g" });
  });

  it("uses a variant's own image when it has one, falling back to the product's image otherwise", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const withOwnImage = await makeVariant(product.id, { name: "200g" });
    const withoutOwnImage = await makeVariant(product.id, { name: "350g" });
    await prisma.productVariantImage.create({ data: { variantId: withOwnImage.id, url: "/variant-200g.webp", altText: "200g pack", isPrimary: true } });

    await addItem(user.id, null, product.id, 1, withOwnImage.id);
    await addItem(user.id, null, product.id, 1, withoutOwnImage.id);
    const summary = await getCart(user.id, null);

    const withImageLine = summary.items.find((item) => item.variantId === withOwnImage.id);
    const withoutImageLine = summary.items.find((item) => item.variantId === withoutOwnImage.id);
    expect(withImageLine).toMatchObject({ imageSrc: "/variant-200g.webp", imageAlt: "200g pack" });
    expect(withoutImageLine).toMatchObject({ imageSrc: "/images/products/export/curry-powder.webp" });
  });

  it("adding the same variant twice combines quantity into one line, not two", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const variant = await makeVariant(product.id);

    await addItem(user.id, null, product.id, 1, variant.id);
    await addItem(user.id, null, product.id, 2, variant.id);
    const summary = await getCart(user.id, null);

    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]?.quantity).toBe(3);
  });

  it("prefers a variant's promoPrice over its base price", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const variant = await makeVariant(product.id, { price: "30.00", promoPrice: "22.00" });

    await addItem(user.id, null, product.id, 1, variant.id);
    const summary = await getCart(user.id, null);

    expect(summary.items[0]?.unitPrice).toBe(22);
  });

  it("rejects adding an inactive variant", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const variant = await makeVariant(product.id, { isActive: false });

    await expect(addItem(user.id, null, product.id, 1, variant.id)).rejects.toThrow(ProductUnavailableError);
  });

  it("rejects adding more than a variant's own stockQuantity, independent of the parent product's stock", async () => {
    const user = await makeUser();
    const product = await makeProduct({ stockQuantity: 0 });
    const variant = await makeVariant(product.id, { stockQuantity: 2 });

    await expect(addItem(user.id, null, product.id, 5, variant.id)).rejects.toThrow(StockExceededError);
    await addItem(user.id, null, product.id, 2, variant.id);
    const summary = await getCart(user.id, null);
    expect(summary.items[0]?.quantity).toBe(2);
  });
});

describe("updateItemQuantity", () => {
  it("updates quantity", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    await addItem(user.id, null, product.id, 1);
    const summary = await getCart(user.id, null);
    const itemId = summary.items[0]!.id;

    await updateItemQuantity(user.id, null, itemId, 4);
    const refreshed = await getCart(user.id, null);
    expect(refreshed.items[0]?.quantity).toBe(4);
  });

  it("rejects updating past stockQuantity", async () => {
    const user = await makeUser();
    const product = await makeProduct({ stockQuantity: 3 });
    await addItem(user.id, null, product.id, 1);
    const summary = await getCart(user.id, null);
    const itemId = summary.items[0]!.id;

    await expect(updateItemQuantity(user.id, null, itemId, 5)).rejects.toThrow(StockExceededError);
  });

  it("rejects updating a cart item that doesn't exist", async () => {
    const user = await makeUser();
    await expect(updateItemQuantity(user.id, null, "does-not-exist", 1)).rejects.toThrow(CartItemNotFoundError);
  });

  it("rejects updating another cart's item", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const product = await makeProduct();
    await addItem(owner.id, null, product.id, 1);
    const summary = await getCart(owner.id, null);
    const itemId = summary.items[0]!.id;

    await expect(updateItemQuantity(intruder.id, null, itemId, 2)).rejects.toThrow(CartItemForbiddenError);
  });
});

describe("removeItem", () => {
  it("removes a line item", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    await addItem(user.id, null, product.id, 1);
    const summary = await getCart(user.id, null);
    const itemId = summary.items[0]!.id;

    await removeItem(user.id, null, itemId);
    const refreshed = await getCart(user.id, null);
    expect(refreshed.items).toHaveLength(0);
  });

  it("rejects removing another cart's item", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const product = await makeProduct();
    await addItem(owner.id, null, product.id, 1);
    const summary = await getCart(owner.id, null);
    const itemId = summary.items[0]!.id;

    await expect(removeItem(intruder.id, null, itemId)).rejects.toThrow(CartItemForbiddenError);
  });
});

describe("revalidation on read", () => {
  it("flags priceChanged exactly once, then reflects the new price on the next read", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    await addItem(user.id, null, product.id, 1);

    // Price moves after the item was added.
    await prisma.standardPrice.create({ data: { productId: product.id, price: "40.00" } });

    const firstRead = await getCart(user.id, null);
    expect(firstRead.items[0]?.priceChanged).toBe(true);
    expect(firstRead.items[0]?.unitPrice).toBe(40);

    const secondRead = await getCart(user.id, null);
    expect(secondRead.items[0]?.priceChanged).toBe(false);
    expect(secondRead.items[0]?.unitPrice).toBe(40);
  });

  it("flags quantityCapped when stock drops below the cart's quantity, without changing the stored quantity", async () => {
    const user = await makeUser();
    const product = await makeProduct({ stockQuantity: 10 });
    await addItem(user.id, null, product.id, 5);

    await prisma.product.update({ where: { id: product.id }, data: { stockQuantity: 2 } });

    const summary = await getCart(user.id, null);
    expect(summary.items[0]?.quantityCapped).toBe(true);
    expect(summary.items[0]?.availableQuantity).toBe(2);
    expect(summary.items[0]?.quantity).toBe(5); // unchanged — customer adjusts themselves
  });

  it("flags unavailable when the product is no longer Published, without removing the line", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    await addItem(user.id, null, product.id, 1);

    await prisma.product.update({ where: { id: product.id }, data: { status: "Draft" } });

    const summary = await getCart(user.id, null);
    expect(summary.items[0]?.unavailable).toBe(true);
    expect(summary.items).toHaveLength(1);
  });

  it("flags unavailable when the product is marked out of stock, without removing the line", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    await addItem(user.id, null, product.id, 1);

    await prisma.product.update({ where: { id: product.id }, data: { inStock: false } });

    const summary = await getCart(user.id, null);
    expect(summary.items[0]?.unavailable).toBe(true);
    expect(summary.items).toHaveLength(1);
  });
});

describe("mergeGuestCartIntoUser", () => {
  it("merges a guest cart's items into a user with no existing cart", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 2);

    await mergeGuestCartIntoUser(user.id, newCookieValue ?? undefined);

    const summary = await getCart(user.id, null);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]?.quantity).toBe(2);
  });

  it("combines quantities for a product both carts already have, capped at stock", async () => {
    const user = await makeUser();
    const product = await makeProduct({ stockQuantity: 4 });
    await addItem(user.id, null, product.id, 2);
    const { newCookieValue } = await addItem(null, undefined, product.id, 3);

    await mergeGuestCartIntoUser(user.id, newCookieValue ?? undefined);

    const summary = await getCart(user.id, null);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]?.quantity).toBe(4); // 2 + 3 = 5, capped at stockQuantity 4
  });

  it("appends a distinct product the guest cart had that the account cart didn't", async () => {
    const user = await makeUser();
    const accountProduct = await makeProduct();
    const guestProduct = await makeProduct();
    await addItem(user.id, null, accountProduct.id, 1);
    const { newCookieValue } = await addItem(null, undefined, guestProduct.id, 1);

    await mergeGuestCartIntoUser(user.id, newCookieValue ?? undefined);

    const summary = await getCart(user.id, null);
    expect(summary.items.map((i) => i.productId).sort()).toEqual([accountProduct.id, guestProduct.id].sort());
  });

  it("deletes the guest cart after a successful merge", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 1);
    const guestToken = verifyCartCookieValue(newCookieValue ?? undefined);

    await mergeGuestCartIntoUser(user.id, newCookieValue ?? undefined);

    expect(await prisma.cart.findUnique({ where: { guestToken: guestToken! } })).toBeNull();
  });

  it("is a no-op when there is no valid guest cookie", async () => {
    const user = await makeUser();
    await expect(mergeGuestCartIntoUser(user.id, undefined)).resolves.not.toThrow();
    expect((await getCart(user.id, null)).items).toHaveLength(0);
  });

  it("a repeated call with the same guest cookie after a successful merge is a safe no-op, never doubling the quantity", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const { newCookieValue } = await addItem(null, undefined, product.id, 2);

    await mergeGuestCartIntoUser(user.id, newCookieValue ?? undefined);
    await mergeGuestCartIntoUser(user.id, newCookieValue ?? undefined);

    const summary = await getCart(user.id, null);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]?.quantity).toBe(2);
  });

  it("preserves a bundle's grouping (bundleId/bundleInstanceId) across the merge, so removeBundleFromCart still finds it afterward — regression for a real bug found live on staging", async () => {
    const user = await makeUser();
    const jar = await makeProduct();
    const sachet = await makeProduct();
    const bundle = await makeFixedBundle([{ product: jar, quantity: 1 }, { product: sachet, quantity: 2 }]);

    const { newCookieValue } = await addBundleToCart(null, undefined, bundle.id, null);
    await mergeGuestCartIntoUser(user.id, newCookieValue ?? undefined);

    const rows = await prisma.cartItem.findMany({ where: { cartId: (await prisma.cart.findUniqueOrThrow({ where: { userId: user.id } })).id } });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.bundleId === bundle.id)).toBe(true);
    const bundleInstanceId = rows[0]!.bundleInstanceId!;
    expect(rows.every((row) => row.bundleInstanceId === bundleInstanceId)).toBe(true);

    // The whole point of preserving the tag: removal-as-a-group still works post-merge.
    await removeBundleFromCart(user.id, undefined, bundleInstanceId);
    expect(await getCart(user.id, null)).toMatchObject({ items: [] });
  });

  it("two different bundle instances never silently merge quantities into each other during a guest→user merge", async () => {
    const user = await makeUser();
    const shared = await makeProduct();
    const bundle = await makeFixedBundle([{ product: shared, quantity: 1 }]);
    await addItem(user.id, null, shared.id, 1); // an unrelated plain line for the same product already in the user's cart
    const { newCookieValue } = await addBundleToCart(null, undefined, bundle.id, null);

    await mergeGuestCartIntoUser(user.id, newCookieValue ?? undefined);

    const summary = await getCart(user.id, null);
    expect(summary.items).toHaveLength(2); // the plain line and the bundle's own row, never combined
    const plainLine = summary.items.find((item) => !item.bundleInstanceId);
    const bundleLine = summary.items.find((item) => item.bundleInstanceId);
    expect(plainLine?.quantity).toBe(1);
    expect(bundleLine?.quantity).toBe(1);
  });

  it("preserves a gift line's giftOfferId/giftInstanceId and $0 price across a guest→user merge — same bug class as the bundle merge above (Landmine 3)", async () => {
    const user = await makeUser();
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift);

    const { newCookieValue } = await addGiftToCart(null, undefined, offer.id);
    await mergeGuestCartIntoUser(user.id, newCookieValue ?? undefined);

    const cart = await prisma.cart.findUniqueOrThrow({ where: { userId: user.id } });
    const rows = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    const giftRow = rows.find((row) => row.productId === gift.id);
    expect(giftRow?.giftOfferId).toBe(offer.id);
    expect(giftRow?.giftInstanceId).not.toBeNull();
    expect(giftRow?.unitPriceSnapshot.toString()).toBe("0");

    // The whole point of preserving the tag: removal-as-a-group still works post-merge.
    await removeGiftFromCart(user.id, undefined, giftRow!.giftInstanceId!);
    expect(await prisma.cartItem.findMany({ where: { giftInstanceId: giftRow!.giftInstanceId! } })).toHaveLength(0);
  });
});

describe("Bundles (Story 2)", () => {
  it("adding a Fixed bundle explodes into one cart row per component, sharing one bundleInstanceId", async () => {
    const jar = await makeProduct();
    await prisma.standardPrice.update({ where: { id: (await prisma.standardPrice.findFirstOrThrow({ where: { productId: jar.id } })).id }, data: { price: "200.00" } });
    const sachet = await makeProduct();
    const bundle = await makeFixedBundle([{ product: jar, quantity: 1 }, { product: sachet, quantity: 2 }]);

    await addBundleToCart(null, undefined, bundle.id, null);

    const rows = await prisma.cartItem.findMany({ where: { bundleId: bundle.id } });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.bundleInstanceId)).size).toBe(1);
    expect(rows.find((r) => r.productId === sachet.id)?.quantity).toBe(2);
  });

  it("two different bundle instances sharing a component product do NOT merge quantities", async () => {
    const shared = await makeProduct();
    const onlyInA = await makeProduct();
    const bundleA = await makeFixedBundle([{ product: shared, quantity: 1 }, { product: onlyInA, quantity: 1 }]);
    const bundleB = await makeFixedBundle([{ product: shared, quantity: 1 }]);

    const { newCookieValue } = await addBundleToCart(null, undefined, bundleA.id, null);
    await addBundleToCart(null, newCookieValue ?? undefined, bundleB.id, null);

    const sharedRows = await prisma.cartItem.findMany({ where: { productId: shared.id } });
    expect(sharedRows).toHaveLength(2);
    expect(sharedRows[0].quantity).toBe(1);
    expect(sharedRows[1].quantity).toBe(1);
    expect(sharedRows[0].bundleInstanceId).not.toBe(sharedRows[1].bundleInstanceId);
  });

  it("removeBundleFromCart deletes every row of the instance in one call", async () => {
    const jar = await makeProduct();
    const sachet = await makeProduct();
    const bundle = await makeFixedBundle([{ product: jar, quantity: 1 }, { product: sachet, quantity: 1 }]);

    const { newCookieValue } = await addBundleToCart(null, undefined, bundle.id, null);
    const rows = await prisma.cartItem.findMany({ where: { bundleId: bundle.id } });
    const bundleInstanceId = rows[0].bundleInstanceId!;

    await removeBundleFromCart(null, newCookieValue ?? undefined, bundleInstanceId);

    expect(await prisma.cartItem.findMany({ where: { bundleInstanceId } })).toHaveLength(0);
  });

  it("a bundle component row's quantity/remove can't be changed individually — cart.service rejects it", async () => {
    const jar = await makeProduct();
    const bundle = await makeFixedBundle([{ product: jar, quantity: 1 }]);
    const { newCookieValue } = await addBundleToCart(null, undefined, bundle.id, null);
    const row = await prisma.cartItem.findFirstOrThrow({ where: { bundleId: bundle.id } });

    await expect(updateItemQuantity(null, newCookieValue ?? undefined, row.id, 5)).rejects.toBeInstanceOf(BundleLineLockedError);
    await expect(removeItem(null, newCookieValue ?? undefined, row.id)).rejects.toBeInstanceOf(BundleLineLockedError);
  });

  it("a cart read flags a bundle's rows unavailable once the bundle is deactivated, without throwing", async () => {
    const jar = await makeProduct();
    const bundle = await makeFixedBundle([{ product: jar, quantity: 1 }]);
    const { newCookieValue } = await addBundleToCart(null, undefined, bundle.id, null);

    await prisma.productBundle.update({ where: { id: bundle.id }, data: { status: "Inactive" } });

    const summary = await getCart(null, newCookieValue);
    expect(summary.items.every((item) => item.unavailable)).toBe(true);
  });
});

describe("Gift Offers (Story 5)", () => {
  it("adding a gift whose underlying product already has a paid line in the cart creates a second, independent row (Landmine 2)", async () => {
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift);

    const { newCookieValue: afterPaid } = await addItem(null, undefined, gift.id, 1);
    await addGiftToCart(null, afterPaid ?? undefined, offer.id);

    const summary = await getCart(null, afterPaid ?? undefined);
    const giftProductLines = summary.items.filter((item) => item.productId === gift.id);
    expect(giftProductLines).toHaveLength(2);
    const paidLine = giftProductLines.find((item) => !item.giftOfferId);
    const giftLine = giftProductLines.find((item) => item.giftOfferId);
    expect(paidLine?.quantity).toBe(1);
    expect(paidLine?.unitPrice).toBe(25);
    expect(giftLine?.unitPrice).toBe(0);
  });

  it("a gift line's price stays pinned at 0 across repeated cart reads even after the gift product's live price changes (Landmine 1)", async () => {
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift);

    const { newCookieValue } = await addGiftToCart(null, undefined, offer.id);

    await prisma.standardPrice.create({ data: { productId: gift.id, price: "999.00" } });

    const firstRead = await getCart(null, newCookieValue ?? undefined);
    const secondRead = await getCart(null, newCookieValue ?? undefined);
    const giftLineFirst = firstRead.items.find((item) => item.giftOfferId === offer.id);
    const giftLineSecond = secondRead.items.find((item) => item.giftOfferId === offer.id);
    expect(giftLineFirst).toMatchObject({ unitPrice: 0, priceChanged: false, lineTotal: 0 });
    expect(giftLineSecond).toMatchObject({ unitPrice: 0, priceChanged: false, lineTotal: 0 });
  });

  it("rewardPointsEarned is 0 for a gift line even though the gift product itself carries rewardPoints", async () => {
    const qualifying = await makeProduct();
    const gift = await makeProduct({ rewardPoints: 10 });
    const offer = await makeGiftOffer(qualifying, gift, { giftQuantity: 2 });

    const { newCookieValue } = await addGiftToCart(null, undefined, offer.id);
    const summary = await getCart(null, newCookieValue ?? undefined);

    const giftLine = summary.items.find((item) => item.giftOfferId === offer.id);
    expect(giftLine?.quantity).toBe(2);
    expect(giftLine?.rewardPointsEarned).toBe(0);
  });

  it("backfills the qualifying product's own line at quantity 1 when it wasn't already in the cart", async () => {
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift);

    const { newCookieValue } = await addGiftToCart(null, undefined, offer.id);
    const summary = await getCart(null, newCookieValue ?? undefined);

    const qualifyingLine = summary.items.find((item) => item.productId === qualifying.id && !item.giftOfferId);
    expect(qualifyingLine?.quantity).toBe(1);
  });

  it("does not add a second qualifying line when the qualifying product is already in the cart", async () => {
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift);

    const { newCookieValue } = await addItem(null, undefined, qualifying.id, 3);
    await addGiftToCart(null, newCookieValue ?? undefined, offer.id);
    const summary = await getCart(null, newCookieValue ?? undefined);

    const qualifyingLines = summary.items.filter((item) => item.productId === qualifying.id && !item.giftOfferId);
    expect(qualifyingLines).toHaveLength(1);
    expect(qualifyingLines[0]?.quantity).toBe(3);
  });

  it("rejects adding a gift below its minQuantity threshold", async () => {
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift, { minQuantity: 3 });

    await expect(addGiftToCart(null, undefined, offer.id)).rejects.toThrow();
  });

  it("rejects adding a gift below its minSpend threshold", async () => {
    const qualifying = await makeProduct(); // standard price 25.00 via makeProduct
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift, { minSpend: "100.00" });

    const { newCookieValue } = await addItem(null, undefined, qualifying.id, 1); // spend = 25, below 100
    await expect(addGiftToCart(null, newCookieValue ?? undefined, offer.id)).rejects.toThrow();
  });

  it("rejects adding a gift once giftStockLimit's unit pool is exhausted", async () => {
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift, { giftStockLimit: 1, giftQuantity: 1 });

    // Simulate one prior redemption directly — exercising the real checkout
    // flow here would be redundant with checkout-service.test.ts.
    const priorOrder = await prisma.order.create({
      data: {
        orderNumber: `GIFT-STOCK-ORDER-${offer.id}`,
        idempotencyKey: `idem-gift-stock-${offer.id}`,
        status: "Confirmed",
        subtotal: "0.00",
        deliveryCharge: "0.00",
        grandTotal: "0.00",
        deliveryZoneName: "Western",
        shipRecipientName: "Test Customer",
        shipPhone: "+94 77 123 4567",
        shipLine1: "10 Test Lane",
        shipCity: "Colombo",
      },
    });
    await prisma.giftOfferRedemption.create({ data: { giftOfferId: offer.id, orderId: priorOrder.id } });

    await expect(addGiftToCart(null, undefined, offer.id)).rejects.toThrow();

    await prisma.giftOfferRedemption.deleteMany({ where: { giftOfferId: offer.id } });
    await prisma.order.delete({ where: { id: priorOrder.id } });
  });

  it("rejects adding a gift whose underlying gift product is out of stock", async () => {
    const qualifying = await makeProduct();
    const gift = await makeProduct({ inStock: false });
    const offer = await makeGiftOffer(qualifying, gift);

    await expect(addGiftToCart(null, undefined, offer.id)).rejects.toThrow();
  });

  it("flags a gift line unavailable on a later read once the qualifying product's quantity drops below minQuantity (Landmine-adjacent revalidation)", async () => {
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift, { minQuantity: 2 });

    const { newCookieValue } = await addItem(null, undefined, qualifying.id, 2);
    await addGiftToCart(null, newCookieValue ?? undefined, offer.id);

    const summary = await getCart(null, newCookieValue ?? undefined);
    const qualifyingLine = summary.items.find((item) => item.productId === qualifying.id && !item.giftOfferId)!;
    await updateItemQuantity(null, newCookieValue ?? undefined, qualifyingLine.id, 1);

    const revalidated = await getCart(null, newCookieValue ?? undefined);
    const giftLine = revalidated.items.find((item) => item.giftOfferId === offer.id);
    expect(giftLine?.unavailable).toBe(true);
  });

  it("removeGiftFromCart deletes only the gift row, leaving the qualifying line untouched", async () => {
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift);

    const { newCookieValue } = await addGiftToCart(null, undefined, offer.id);
    const rows = await prisma.cartItem.findMany({ where: { giftOfferId: offer.id } });
    const giftInstanceId = rows[0]!.giftInstanceId!;

    await removeGiftFromCart(null, newCookieValue ?? undefined, giftInstanceId);
    const summary = await getCart(null, newCookieValue ?? undefined);

    expect(summary.items.some((item) => item.giftOfferId)).toBe(false);
    expect(summary.items.some((item) => item.productId === qualifying.id)).toBe(true);
  });

  it("a gift line's quantity/remove can't be changed through the generic cart endpoints — resizing it directly would let a customer claim more free units than giftQuantity entitles them to (found live via browser walkthrough: the cart drawer renders a gift row with the same generic +/- and X controls as any other line)", async () => {
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift, { giftQuantity: 1 });
    const { newCookieValue } = await addGiftToCart(null, undefined, offer.id);
    const row = await prisma.cartItem.findFirstOrThrow({ where: { giftOfferId: offer.id } });

    await expect(updateItemQuantity(null, newCookieValue ?? undefined, row.id, 5)).rejects.toBeInstanceOf(GiftLineLockedError);
    await expect(removeItem(null, newCookieValue ?? undefined, row.id)).rejects.toBeInstanceOf(GiftLineLockedError);

    // The qualifying line is a perfectly normal, unlocked cart line — only the $0 gift row itself is locked.
    const qualifyingRow = await prisma.cartItem.findFirstOrThrow({ where: { productId: qualifying.id, giftOfferId: null } });
    await expect(updateItemQuantity(null, newCookieValue ?? undefined, qualifyingRow.id, 2)).resolves.not.toThrow();
  });

  it("a cart read flags a gift line unavailable once the offer is deactivated, without throwing or removing it", async () => {
    const qualifying = await makeProduct();
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift);
    const { newCookieValue } = await addGiftToCart(null, undefined, offer.id);

    await prisma.giftOffer.update({ where: { id: offer.id }, data: { status: "Inactive" } });

    const summary = await getCart(null, newCookieValue ?? undefined);
    const giftLine = summary.items.find((item) => item.giftOfferId === offer.id);
    expect(giftLine?.unavailable).toBe(true);
  });

  it("qualifying-variant pin: buying the pinned variant unlocks the gift, and backfills a line for that exact variant", async () => {
    const qualifying = await makeProduct();
    const pinnedVariant = await makeVariant(qualifying.id, { name: "1Kg", price: "900.00" });
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift, { qualifyingVariant: { connect: { id: pinnedVariant.id } } });

    const { newCookieValue } = await addGiftToCart(null, undefined, offer.id);
    const summary = await getCart(null, newCookieValue ?? undefined);

    const qualifyingLine = summary.items.find((item) => item.productId === qualifying.id && !item.giftOfferId);
    expect(qualifyingLine?.variantId).toBe(pinnedVariant.id);
    expect(qualifyingLine?.quantity).toBe(1);
    const giftLine = summary.items.find((item) => item.giftOfferId === offer.id);
    expect(giftLine?.unavailable).toBeFalsy();
  });

  it("qualifying-variant pin: buying a different variant of the same product does not unlock the gift", async () => {
    const qualifying = await makeProduct();
    const pinnedVariant = await makeVariant(qualifying.id, { name: "1Kg", price: "900.00" });
    const otherVariant = await makeVariant(qualifying.id, { name: "100g", price: "150.00" });
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift, { qualifyingVariant: { connect: { id: pinnedVariant.id } }, minQuantity: 1 });

    const { newCookieValue } = await addItem(null, undefined, qualifying.id, 1, otherVariant.id);
    await expect(addGiftToCart(null, newCookieValue ?? undefined, offer.id)).rejects.toThrow();
  });

  it("qualifying-variant pin: a previously-eligible gift line is flagged unavailable once the pinned variant's line is swapped for a different variant", async () => {
    const qualifying = await makeProduct();
    const pinnedVariant = await makeVariant(qualifying.id, { name: "1Kg", price: "900.00" });
    const otherVariant = await makeVariant(qualifying.id, { name: "100g", price: "150.00" });
    const gift = await makeProduct();
    const offer = await makeGiftOffer(qualifying, gift, { qualifyingVariant: { connect: { id: pinnedVariant.id } }, minQuantity: 1 });

    const { newCookieValue } = await addItem(null, undefined, qualifying.id, 1, pinnedVariant.id);
    await addGiftToCart(null, newCookieValue ?? undefined, offer.id);
    const qualifyingRow = await prisma.cartItem.findFirstOrThrow({ where: { productId: qualifying.id, giftOfferId: null } });
    await removeItem(null, newCookieValue ?? undefined, qualifyingRow.id);
    await addItem(null, newCookieValue ?? undefined, qualifying.id, 1, otherVariant.id);

    const revalidated = await getCart(null, newCookieValue ?? undefined);
    const giftLine = revalidated.items.find((item) => item.giftOfferId === offer.id);
    expect(giftLine?.unavailable).toBe(true);
  });
});

describe("Custom Packaging (Story 3)", () => {
  it("folds the packaging charge into lineTotal/subtotal while unitPrice stays the product's own price", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id, { charge: "15.00" });

    await addItem(user.id, null, product.id, 2, null, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const summary = await getCart(user.id, null);

    expect(summary.items).toHaveLength(1);
    // packagingCharge is this line's already-final packaging TOTAL (charge x
    // quantity), not a per-unit rate — see cart.service.ts::toLineItem.
    expect(summary.items[0]).toMatchObject({ unitPrice: 25, packagingCharge: 30, quantity: 2, lineTotal: 80 });
    expect(summary.subtotal).toBe(80);
  });

  it("rejects adding an Export-only option declared Local", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id, { availability: "Export" });

    await expect(addItem(user.id, null, product.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Local" })).rejects.toBeInstanceOf(PackagingAvailabilityMismatchError);
  });

  it("rejects adding below the option's minimum quantity", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id, { minQuantity: 3 });

    await expect(addItem(user.id, null, product.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Local" })).rejects.toBeInstanceOf(PackagingMinimumQuantityError);
  });

  it("a deactivated packaging option flags the line unavailable on read, without throwing or removing it", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id);
    await addItem(user.id, null, product.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Local" });

    await prisma.productPackagingOption.update({ where: { id: option.id }, data: { status: "Discontinued" } });

    const summary = await getCart(user.id, null);
    expect(summary.items).toHaveLength(1);
    expect(summary.items[0]?.unavailable).toBe(true);
  });

  it("a past order-cutoff date flags the line unavailable on a later read", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id, { orderCutoffDate: new Date(Date.now() + 60_000) });
    await addItem(user.id, null, product.id, 1, null, { packagingOptionId: option.id, declaredAvailability: "Local" });

    await prisma.productPackagingOption.update({ where: { id: option.id }, data: { orderCutoffDate: new Date(Date.now() - 60_000) } });

    const summary = await getCart(user.id, null);
    expect(summary.items[0]?.unavailable).toBe(true);
  });

  it("rejects lowering quantity below the pinned option's minimum quantity", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const option = await makePackagingOption(product.id, { minQuantity: 2 });
    await addItem(user.id, null, product.id, 2, null, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const summary = await getCart(user.id, null);
    const itemId = summary.items[0]!.id;

    await expect(updateItemQuantity(user.id, null, itemId, 1)).rejects.toBeInstanceOf(PackagingMinimumQuantityError);
  });

  it("two different packaging selections of the same product are independent lines, never merged", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const optionA = await makePackagingOption(product.id);
    const optionB = await makePackagingOption(product.id);

    await addItem(user.id, null, product.id, 1, null, { packagingOptionId: optionA.id, declaredAvailability: "Local" });
    await addItem(user.id, null, product.id, 1, null, { packagingOptionId: optionB.id, declaredAvailability: "Local" });

    const summary = await getCart(user.id, null);
    expect(summary.items).toHaveLength(2);
  });
});

describe("Weight-based packaging (Story 3b)", () => {
  it("charges weight x rate for a single variant/quantity", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const variant = await makeVariant(product.id, { netWeightGrams: 200 });
    const option = await makePackagingOption(product.id, { chargeType: "PerGram", charge: "0", ratePerGram: "0.50" });

    await addItem(user.id, null, product.id, 1, variant.id, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const summary = await getCart(user.id, null);

    // 200g x 1 x LKR 0.50/g = LKR 100.
    expect(summary.items[0]).toMatchObject({ packagingCharge: 100, packagingChargeType: "PerGram", packagingNetWeightGrams: 200 });
  });

  it("scales the charge with quantity for the same variant", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const variant = await makeVariant(product.id, { netWeightGrams: 200 });
    const option = await makePackagingOption(product.id, { chargeType: "PerGram", charge: "0", ratePerGram: "0.50" });

    await addItem(user.id, null, product.id, 3, variant.id, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const summary = await getCart(user.id, null);

    // 200g x 3 x LKR 0.50/g = LKR 300.
    expect(summary.items[0]).toMatchObject({ packagingCharge: 300, packagingNetWeightGrams: 600 });
  });

  it("aggregates weight across different variants sharing one whole-product option into a single charge, split proportionally", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const variant200 = await makeVariant(product.id, { netWeightGrams: 200, name: "200g" });
    const variant350 = await makeVariant(product.id, { netWeightGrams: 350, name: "350g" });
    // variantId: null (whole-product) so both variants share the same option row.
    const option = await makePackagingOption(product.id, { chargeType: "PerGram", charge: "0", ratePerGram: "0.50" });

    // The doc's own worked example: two 200g units + one 350g unit = 750g.
    await addItem(user.id, null, product.id, 2, variant200.id, { packagingOptionId: option.id, declaredAvailability: "Local" });
    await addItem(user.id, null, product.id, 1, variant350.id, { packagingOptionId: option.id, declaredAvailability: "Local" });

    const summary = await getCart(user.id, null);
    expect(summary.items).toHaveLength(2);
    const totalPackagingCharge = summary.items.reduce((sum, item) => sum + item.packagingCharge, 0);
    // 750g x LKR 0.50/g = LKR 375, allocated across both lines exactly once.
    expect(totalPackagingCharge).toBeCloseTo(375, 2);
    // Each variant's own unitPrice defaults to LKR 30 (makeVariant) x quantity, plus the 375 packaging charge.
    expect(summary.subtotal).toBeCloseTo(30 * 2 + 30 * 1 + 375, 2);
  });

  it("different products with their own PerGram options are priced independently, never mixed into one group", async () => {
    const user = await makeUser();
    const productA = await makeProduct();
    const variantA = await makeVariant(productA.id, { netWeightGrams: 200 });
    const optionA = await makePackagingOption(productA.id, { chargeType: "PerGram", charge: "0", ratePerGram: "0.50" });

    const productB = await makeProduct();
    const variantB = await makeVariant(productB.id, { netWeightGrams: 500 });
    const optionB = await makePackagingOption(productB.id, { chargeType: "PerGram", charge: "0", ratePerGram: "1.00" });

    await addItem(user.id, null, productA.id, 1, variantA.id, { packagingOptionId: optionA.id, declaredAvailability: "Local" });
    await addItem(user.id, null, productB.id, 1, variantB.id, { packagingOptionId: optionB.id, declaredAvailability: "Local" });

    const summary = await getCart(user.id, null);
    const lineA = summary.items.find((item) => item.productId === productA.id);
    const lineB = summary.items.find((item) => item.productId === productB.id);
    expect(lineA?.packagingCharge).toBeCloseTo(100, 2); // 200g x 0.50
    expect(lineB?.packagingCharge).toBeCloseTo(500, 2); // 500g x 1.00
  });

  it("a non-eligible product (no packaging option configured) never carries a packaging charge", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const variant = await makeVariant(product.id, { netWeightGrams: 200 });

    await addItem(user.id, null, product.id, 2, variant.id);
    const summary = await getCart(user.id, null);

    expect(summary.items[0]).toMatchObject({ packagingOptionId: null, packagingCharge: 0, packagingChargeType: null });
  });

  it("rejects adding below the option's minimum order weight", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const variant = await makeVariant(product.id, { netWeightGrams: 200 });
    const option = await makePackagingOption(product.id, { chargeType: "PerGram", charge: "0", ratePerGram: "0.50", minOrderWeightGrams: 1000 });

    await expect(addItem(user.id, null, product.id, 1, variant.id, { packagingOptionId: option.id, declaredAvailability: "Local" })).rejects.toBeInstanceOf(PackagingMinimumWeightError);
  });

  it("accepts an add that only clears the minimum order weight in combination with an existing sibling line", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const variant900 = await makeVariant(product.id, { netWeightGrams: 900, name: "900g" });
    const variant200 = await makeVariant(product.id, { netWeightGrams: 200, name: "200g" });
    const option = await makePackagingOption(product.id, { chargeType: "PerGram", charge: "0", ratePerGram: "0.50", minOrderWeightGrams: 1000 });

    // 2 x 900g = 1800g clears the 1000g floor on its own.
    await addItem(user.id, null, product.id, 2, variant900.id, { packagingOptionId: option.id, declaredAvailability: "Local" });
    // A lone 200g add would fail the 1000g floor by itself, but it clears it
    // in combination with the 1800g already in the cart under the same option.
    await expect(
      addItem(user.id, null, product.id, 1, variant200.id, { packagingOptionId: option.id, declaredAvailability: "Local" }),
    ).resolves.toBeDefined();

    const summary = await getCart(user.id, null);
    expect(summary.items.every((item) => !item.unavailable)).toBe(true);
  });

  it("floors the charge at the configured minimum packaging charge", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const variant = await makeVariant(product.id, { netWeightGrams: 100 });
    const option = await makePackagingOption(product.id, { chargeType: "PerGram", charge: "0", ratePerGram: "0.50", minPackagingCharge: "100.00" });

    await addItem(user.id, null, product.id, 1, variant.id, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const summary = await getCart(user.id, null);

    // Raw charge (100g x 0.50 = 50) is below the 100.00 minimum, so the floor applies.
    expect(summary.items[0]).toMatchObject({ packagingCharge: 100, packagingMinimumChargeApplied: true });
  });

  it("recomputes the charge when quantity changes", async () => {
    const user = await makeUser();
    const product = await makeProduct();
    const variant = await makeVariant(product.id, { netWeightGrams: 200 });
    const option = await makePackagingOption(product.id, { chargeType: "PerGram", charge: "0", ratePerGram: "0.50" });

    await addItem(user.id, null, product.id, 1, variant.id, { packagingOptionId: option.id, declaredAvailability: "Local" });
    const before = await getCart(user.id, null);
    const itemId = before.items[0]!.id;

    await updateItemQuantity(user.id, null, itemId, 4);
    const after = await getCart(user.id, null);

    // 200g x 4 x LKR 0.50/g = LKR 400.
    expect(after.items[0]).toMatchObject({ packagingCharge: 400, packagingNetWeightGrams: 800 });
  });
});
