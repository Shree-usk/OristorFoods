import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";

async function signInAs(page: import("@playwright/test").Page, userId: string) {
  const token = await encode({
    token: { sub: userId },
    secret: process.env.AUTH_SECRET!,
    salt: "authjs.session-token",
  });
  await page.context().addCookies([
    {
      name: "authjs.session-token",
      value: token,
      domain: "localhost",
      path: "/",
    },
  ]);
}

const TEST_SKUS = ["E2E-WISH-1", "E2E-WISH-2", "E2E-WISH-3"];
const TEST_EMAILS = ["e2e-wishlist@test.com", "e2e-wishlist-2@test.com"];

test.describe("Wishlist", () => {
  // Scoped (not a blanket `deleteMany()`, unlike the unit-test pattern) so
  // this doesn't wipe catalogue/user data other e2e specs rely on when the
  // full suite runs together. `beforeEach` (not `afterEach`) so a previous
  // run that crashed mid-test (leaving rows behind) doesn't break the next
  // run via unique constraint violations on sku/email.
  test.beforeEach(async () => {
    await prisma.product.deleteMany({ where: { sku: { in: TEST_SKUS } } });
    await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  });

  test("guest adds items, logs in, items persist and merge into the account wishlist", async ({ page }) => {
    const product = await createProduct({
      sku: "E2E-WISH-1",
      slug: "e2e-wish-1",
      name: "E2E Curry Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });
    const user = await prisma.user.create({ data: { email: "e2e-wishlist@test.com" } });

    await page.goto(`/products/${product.slug}`);
    await page.getByRole("button", { name: "Add to wishlist" }).click();
    await expect(page.getByRole("button", { name: "Remove from wishlist" })).toBeVisible();

    await signInAs(page, user.id);
    await page.goto("/account/wishlist");

    await expect(page.getByText("E2E Curry Powder")).toBeVisible();
  });

  test("move all to cart is disabled and shows the in-stock count (cart not built yet)", async ({ page }) => {
    const inStockProduct = await createProduct({
      sku: "E2E-WISH-2",
      slug: "e2e-wish-2",
      name: "In Stock Item",
      status: "Published",
      inStock: true,
    });
    const outOfStockProduct = await createProduct({
      sku: "E2E-WISH-3",
      slug: "e2e-wish-3",
      name: "Out Of Stock Item",
      status: "Published",
      inStock: false,
    });
    await createStandardPrice({ product: { connect: { id: inStockProduct.id } }, price: "300.00" });
    await createStandardPrice({ product: { connect: { id: outOfStockProduct.id } }, price: "300.00" });
    const user = await prisma.user.create({ data: { email: "e2e-wishlist-2@test.com" } });
    const wishlist = await prisma.wishlist.create({ data: { userId: user.id } });
    await prisma.wishlistItem.createMany({
      data: [
        { wishlistId: wishlist.id, productId: inStockProduct.id },
        { wishlistId: wishlist.id, productId: outOfStockProduct.id },
      ],
    });

    await signInAs(page, user.id);
    await page.goto("/account/wishlist");

    await expect(page.getByText("1 of 2 items in stock")).toBeVisible();
    await expect(page.getByRole("button", { name: "Move all to cart" })).toBeDisabled();
  });
});
