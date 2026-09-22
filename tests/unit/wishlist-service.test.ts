// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import {
  addToWishlist,
  getWishlist,
  mergeGuestWishlist,
  removeFromWishlist,
} from "@/services/wishlist.service";

async function createUser(email: string) {
  return prisma.user.create({ data: { email, name: "Test User" } });
}

async function publishedProductWithPrice(sku: string, slug: string, name: string, price: string) {
  const product = await createProduct({ sku, slug, name, status: "Published" });
  await createStandardPrice({ product: { connect: { id: product.id } }, price });
  return product;
}

afterEach(async () => {
  await prisma.wishlistItem.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("addToWishlist / getWishlist / removeFromWishlist", () => {
  it("adds a product and returns it with a resolved price", async () => {
    const user = await createUser("wishlist-svc-1@test.com");
    const product = await publishedProductWithPrice("WISH-SVC-1", "wish-svc-1", "Curry Powder", "450.00");

    await addToWishlist(user.id, product.id);
    const items = await getWishlist(user.id);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: product.id, name: "Curry Powder", price: 450 });
  });

  it("adding the same product twice is a no-op, not an error", async () => {
    const user = await createUser("wishlist-svc-2@test.com");
    const product = await publishedProductWithPrice("WISH-SVC-2", "wish-svc-2", "Chili Paste", "300.00");

    await addToWishlist(user.id, product.id);
    await expect(addToWishlist(user.id, product.id)).resolves.not.toThrow();

    const items = await getWishlist(user.id);
    expect(items).toHaveLength(1);
  });

  it("excludes items with no price configured", async () => {
    const user = await createUser("wishlist-svc-3@test.com");
    const product = await createProduct({
      sku: "WISH-SVC-3",
      slug: "wish-svc-3",
      name: "No Price Yet",
      status: "Published",
    });

    await addToWishlist(user.id, product.id);
    const items = await getWishlist(user.id);

    expect(items).toHaveLength(0);
  });

  it("removes a product", async () => {
    const user = await createUser("wishlist-svc-4@test.com");
    const product = await publishedProductWithPrice("WISH-SVC-4", "wish-svc-4", "Ginger Powder", "200.00");
    await addToWishlist(user.id, product.id);

    await removeFromWishlist(user.id, product.id);

    expect(await getWishlist(user.id)).toHaveLength(0);
  });
});

describe("mergeGuestWishlist", () => {
  it("adds guest products the user doesn't already have", async () => {
    const user = await createUser("wishlist-svc-5@test.com");
    const a = await publishedProductWithPrice("WISH-SVC-5", "wish-svc-5", "Product A", "100.00");
    const b = await publishedProductWithPrice("WISH-SVC-6", "wish-svc-6", "Product B", "150.00");

    await mergeGuestWishlist(user.id, [a.id, b.id]);
    const items = await getWishlist(user.id);

    expect(items.map((item) => item.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("de-duplicates against products already in the wishlist", async () => {
    const user = await createUser("wishlist-svc-7@test.com");
    const a = await publishedProductWithPrice("WISH-SVC-7", "wish-svc-7", "Already There", "100.00");
    await addToWishlist(user.id, a.id);

    await mergeGuestWishlist(user.id, [a.id]);
    const items = await getWishlist(user.id);

    expect(items).toHaveLength(1);
  });

  it("silently ignores product ids that no longer exist", async () => {
    const user = await createUser("wishlist-svc-8@test.com");

    await expect(mergeGuestWishlist(user.id, ["does-not-exist"])).resolves.not.toThrow();
    expect(await getWishlist(user.id)).toHaveLength(0);
  });

  it("silently ignores unpublished products", async () => {
    const user = await createUser("wishlist-svc-9@test.com");
    const draft = await createProduct({
      sku: "WISH-SVC-8",
      slug: "wish-svc-8",
      name: "Draft Product",
      status: "Draft",
    });

    await mergeGuestWishlist(user.id, [draft.id]);

    expect(await getWishlist(user.id)).toHaveLength(0);
  });

  it("does nothing for an empty list", async () => {
    const user = await createUser("wishlist-svc-10@test.com");

    await expect(mergeGuestWishlist(user.id, [])).resolves.not.toThrow();
  });
});
