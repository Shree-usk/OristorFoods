// tests/unit/cart-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { verifyCartCookieValue } from "@/lib/cart-token";
import { createProduct } from "@/repositories/product.repository";
import {
  CartItemForbiddenError,
  CartItemNotFoundError,
  ProductUnavailableError,
  StockExceededError,
} from "@/services/cart.errors";
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

afterEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: "CART-SVC-SKU-" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "cart-svc-" } } });
});

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
});
