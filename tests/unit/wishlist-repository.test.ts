// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  addItem,
  findExistingProductIds,
  findOrCreateWishlist,
  listItemsWithProduct,
  removeItem,
} from "@/repositories/wishlist.repository";

async function createUser(email: string) {
  return prisma.user.create({ data: { email, name: "Test User" } });
}

afterEach(async () => {
  await prisma.wishlistItem.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("findOrCreateWishlist", () => {
  it("creates a wishlist on first call and returns the same one on the second", async () => {
    const user = await createUser("wishlist-repo-1@test.com");

    const first = await findOrCreateWishlist(user.id);
    const second = await findOrCreateWishlist(user.id);

    expect(first.id).toBe(second.id);
    expect(first.userId).toBe(user.id);
  });
});

describe("addItem / removeItem / listItemsWithProduct", () => {
  it("adds an item and lists it with its product and primary image", async () => {
    const user = await createUser("wishlist-repo-2@test.com");
    const wishlist = await findOrCreateWishlist(user.id);
    const product = await createProduct({
      sku: "WISH-REPO-1",
      slug: "wish-repo-1",
      name: "Chili Paste",
      status: "Published",
    });

    await addItem(wishlist.id, product.id);
    const items = await listItemsWithProduct(wishlist.id);

    expect(items).toHaveLength(1);
    expect(items[0]?.product.id).toBe(product.id);
    expect(items[0]?.product.name).toBe("Chili Paste");
  });

  it("excludes items whose product is no longer Published", async () => {
    const user = await createUser("wishlist-repo-3@test.com");
    const wishlist = await findOrCreateWishlist(user.id);
    const product = await createProduct({
      sku: "WISH-REPO-2",
      slug: "wish-repo-2",
      name: "Discontinued Item",
      status: "Discontinued",
    });

    await addItem(wishlist.id, product.id);
    const items = await listItemsWithProduct(wishlist.id);

    expect(items).toHaveLength(0);
  });

  it("removes an item", async () => {
    const user = await createUser("wishlist-repo-4@test.com");
    const wishlist = await findOrCreateWishlist(user.id);
    const product = await createProduct({
      sku: "WISH-REPO-3",
      slug: "wish-repo-3",
      name: "Curry Powder",
      status: "Published",
    });
    await addItem(wishlist.id, product.id);

    await removeItem(wishlist.id, product.id);
    const items = await listItemsWithProduct(wishlist.id);

    expect(items).toHaveLength(0);
  });

  it("removing a non-existent item is a no-op, not an error", async () => {
    const user = await createUser("wishlist-repo-5@test.com");
    const wishlist = await findOrCreateWishlist(user.id);

    await expect(removeItem(wishlist.id, "does-not-exist")).resolves.not.toThrow();
  });
});

describe("findExistingProductIds", () => {
  it("returns only the ids already in the wishlist", async () => {
    const user = await createUser("wishlist-repo-6@test.com");
    const wishlist = await findOrCreateWishlist(user.id);
    const inWishlist = await createProduct({
      sku: "WISH-REPO-4",
      slug: "wish-repo-4",
      name: "Already Saved",
      status: "Published",
    });
    const notInWishlist = await createProduct({
      sku: "WISH-REPO-5",
      slug: "wish-repo-5",
      name: "Not Saved",
      status: "Published",
    });
    await addItem(wishlist.id, inWishlist.id);

    const existing = await findExistingProductIds(wishlist.id, [inWishlist.id, notInWishlist.id]);

    expect(existing).toEqual([inWishlist.id]);
  });

  it("returns an empty array for an empty input", async () => {
    const user = await createUser("wishlist-repo-7@test.com");
    const wishlist = await findOrCreateWishlist(user.id);

    expect(await findExistingProductIds(wishlist.id, [])).toEqual([]);
  });
});
