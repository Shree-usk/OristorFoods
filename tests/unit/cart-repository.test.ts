// tests/unit/cart-repository.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  createGuestCart,
  createUserCart,
  deleteCart,
  deleteCartItem,
  findCartByGuestToken,
  findCartByUserId,
  findCartItemById,
  listCartItemsWithProduct,
  updateCartItemQuantity,
  upsertCartItem,
} from "@/repositories/cart.repository";

let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `cart-repo-${sequence}@test.com` } });
}

async function makeProduct(overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return createProduct({
    sku: `CART-REPO-SKU-${sequence}`,
    slug: `cart-repo-product-${sequence}`,
    name: `Cart Repo Product ${sequence}`,
    status: "Published",
    stockQuantity: 100,
    ...overrides,
  });
}

afterEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: "CART-REPO-SKU-" } } });
  await prisma.user.deleteMany({ where: { email: { contains: "cart-repo-" } } });
});

describe("createUserCart / findCartByUserId", () => {
  it("creates and finds a cart by userId", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    expect(await findCartByUserId(user.id)).toMatchObject({ id: cart.id, userId: user.id });
  });

  it("returns null for a user with no cart", async () => {
    const user = await makeUser();
    expect(await findCartByUserId(user.id)).toBeNull();
  });
});

describe("createGuestCart / findCartByGuestToken", () => {
  it("creates and finds a cart by guestToken", async () => {
    const cart = await createGuestCart("test-guest-token-1");
    expect(await findCartByGuestToken("test-guest-token-1")).toMatchObject({ id: cart.id });
  });

  it("returns null for an unknown guestToken", async () => {
    expect(await findCartByGuestToken("does-not-exist")).toBeNull();
  });
});

describe("upsertCartItem", () => {
  it("creates a new line item", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    const product = await makeProduct();

    const item = await upsertCartItem(cart.id, product.id, 2, "10.00");
    expect(item.quantity).toBe(2);
  });

  it("adding the same product again increments quantity rather than duplicating the row", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    const product = await makeProduct();

    await upsertCartItem(cart.id, product.id, 2, "10.00");
    const second = await upsertCartItem(cart.id, product.id, 3, "10.00");

    expect(second.quantity).toBe(5);
    const items = await listCartItemsWithProduct(cart.id);
    expect(items).toHaveLength(1);
  });
});

describe("updateCartItemQuantity / deleteCartItem", () => {
  it("updates quantity", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    const product = await makeProduct();
    const item = await upsertCartItem(cart.id, product.id, 1, "10.00");

    const updated = await updateCartItemQuantity(item.id, 5);
    expect(updated.quantity).toBe(5);
  });

  it("deletes a line item", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    const product = await makeProduct();
    const item = await upsertCartItem(cart.id, product.id, 1, "10.00");

    await deleteCartItem(item.id);
    expect(await findCartItemById(item.id)).toBeNull();
  });
});

describe("listCartItemsWithProduct", () => {
  it("returns every line item with its joined product", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    const productA = await makeProduct();
    const productB = await makeProduct();
    await upsertCartItem(cart.id, productA.id, 1, "10.00");
    await upsertCartItem(cart.id, productB.id, 2, "20.00");

    const items = await listCartItemsWithProduct(cart.id);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.product.id).sort()).toEqual([productA.id, productB.id].sort());
  });
});

describe("deleteCart", () => {
  it("deletes the cart and cascades its items", async () => {
    const user = await makeUser();
    const cart = await createUserCart(user.id);
    const product = await makeProduct();
    await upsertCartItem(cart.id, product.id, 1, "10.00");

    await deleteCart(cart.id);

    expect(await findCartByUserId(user.id)).toBeNull();
    expect(await prisma.cartItem.count({ where: { cartId: cart.id } })).toBe(0);
  });
});
