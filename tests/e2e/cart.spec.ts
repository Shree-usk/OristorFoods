import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";

import { signInAs } from "./helpers/auth";

const SKU_PREFIX = "E2E-CART-";
const EMAIL_DOMAIN = "@e2e-cart.test";

async function seedProduct(n: number, name: string, stockQuantity: number) {
  const product = await createProduct({
    sku: `${SKU_PREFIX}${n}`,
    slug: `e2e-cart-product-${n}`,
    name,
    status: "Published",
    stockQuantity,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price: "30.00" } });
  return product;
}

test.describe("Shopping cart", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.standardPrice.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("adding an item as a guest persists across reload, then merges into the account on sign-in", async ({ page }) => {
    const product = await seedProduct(1, "E2E Cart Curry Powder", 20);
    const user = await prisma.user.create({ data: { email: `merge${EMAIL_DOMAIN}`, name: "Merge Tester" } });

    const addResponse = await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 2 } });
    expect(addResponse.status()).toBe(200);

    await page.goto("/cart");
    await expect(page.getByText("E2E Cart Curry Powder")).toBeVisible();

    await page.reload();
    await expect(page.getByText("E2E Cart Curry Powder")).toBeVisible();

    await signInAs(page, user.id);
    await page.request.post("/api/cart/merge");
    await page.reload();

    await expect(page.getByText("E2E Cart Curry Powder")).toBeVisible();
  });

  test("adding a quantity beyond stock is blocked with a clear message", async ({ page }) => {
    const product = await seedProduct(2, "E2E Cart Limited Stock Item", 2);

    const response = await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 5 } });
    expect(response.status()).toBe(409);
    const body = (await response.json()) as { error: string; availableQuantity: number };
    expect(body.availableQuantity).toBe(2);
  });

  test("adding past stock through the real Add to Cart button shows a visible error message", async ({ page }) => {
    const product = await seedProduct(4, "E2E Cart PDP Limited Stock", 1);

    await page.goto(`/products/${product.slug}`);
    const addToCart = page.getByRole("button", { name: "Add to Cart" });
    await addToCart.click(); // consumes the only unit in stock
    await addToCart.click(); // now exceeds stock

    await expect(page.getByText(/only 1 left in stock/i)).toBeVisible();
  });

  test("clicking Add to Cart on the PDP opens the cart drawer as confirmation", async ({ page }) => {
    const product = await seedProduct(5, "E2E Cart Drawer Item", 10);

    await page.goto(`/products/${product.slug}`);
    await page.getByRole("button", { name: "Add to Cart" }).click();

    const drawer = page.getByRole("dialog", { name: "Shopping cart" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("E2E Cart Drawer Item")).toBeVisible();

    await drawer.getByRole("button", { name: "Close cart" }).click();
    await expect(drawer).not.toBeVisible();
  });

  test("the cart page has no detectable accessibility violations", async ({ page }) => {
    const product = await seedProduct(3, "E2E Cart A11y Item", 10);
    await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 1 } });

    await page.goto("/cart");
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
