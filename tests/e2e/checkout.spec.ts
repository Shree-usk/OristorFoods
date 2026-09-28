import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";

const SKU_PREFIX = "E2E-CHK-";

async function seedProduct(n: number, name: string, price: string, stockQuantity = 20) {
  const product = await createProduct({
    sku: `${SKU_PREFIX}${n}`,
    slug: `e2e-chk-product-${n}`,
    name,
    status: "Published",
    stockQuantity,
    weightGrams: 150,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price } });
  return product;
}

async function seedZones() {
  await prisma.shippingSetting.upsert({
    where: { id: "global" },
    update: { freeShippingThreshold: "7500.00" },
    create: { id: "global", freeShippingThreshold: "7500.00" },
  });
  await prisma.deliveryZone.create({
    data: {
      name: "E2E Western",
      cities: ["Colombo"],
      rate: { create: { rateType: "Flat", flatAmount: "350.00", estimatedDaysMin: 1, estimatedDaysMax: 2 } },
    },
  });
}

async function fillAddressStep(page: Page) {
  await page.getByLabel("Email address").fill("guest@e2e-chk.test");
  await page.getByLabel("Recipient name").fill("E2E Guest");
  await page.getByLabel("Phone number").fill("+94 77 123 4567");
  await page.getByLabel("Address line 1", { exact: true }).fill("42 Test Street");
  await page.getByLabel("City", { exact: true }).fill("Colombo");
  await page.getByRole("button", { name: "Continue to Delivery" }).click();
}

test.describe("Checkout", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.orderStatusHistory.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.deliveryRateOverride.deleteMany();
    await prisma.deliveryRate.deleteMany();
    await prisma.deliveryZone.deleteMany({ where: { name: { startsWith: "E2E " } } });
    await prisma.standardPrice.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  });

  test("an empty cart redirects to the cart page", async ({ page }) => {
    await page.goto("/checkout");
    await page.waitForURL("**/cart");
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();
  });

  test("a guest completes the full checkout with a mock success payment", async ({ page }) => {
    await seedZones();
    const product = await seedProduct(1, "E2E Checkout Curry Powder", "1000.00");
    await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 2 } });

    await page.goto("/checkout");

    // Step 1: Address
    await fillAddressStep(page);

    // Step 2: Delivery — zone and charge visible before payment
    await expect(page.getByText("E2E Western")).toBeVisible();
    await expect(page.getByText("LKR 350.00")).toBeVisible();
    await expect(page.getByText(/Add LKR .* more for free shipping/)).toBeVisible();
    await page.getByRole("button", { name: "Continue to Payment" }).click();

    // Step 3: Payment — mock success
    await page.getByRole("radio", { name: /Mock payment — Success/ }).check();
    await page.getByRole("button", { name: "Pay now" }).click();

    // Step 4: Review — server-derived totals, then place
    await expect(page.getByRole("heading", { name: "Review & Place Order" })).toBeVisible();
    await expect(page.getByText("LKR 2350.00")).toBeVisible();
    await page.getByRole("button", { name: "Place Order" }).click();

    // Confirmation
    await page.waitForURL("**/checkout/confirmation/**");
    await expect(page.getByRole("heading", { name: "Thank you for your order!" })).toBeVisible();
    await expect(page.getByText(/ORS-\d{8}-[0-9A-Z]{6}/)).toBeVisible();

    // The cart was cleared.
    const cartResponse = await page.request.get("/api/cart");
    const cart = (await cartResponse.json()) as { items: unknown[] };
    expect(cart.items).toHaveLength(0);

    // The order is in the database with the right totals.
    const order = await prisma.order.findFirst({ include: { items: true } });
    expect(order?.grandTotal.toFixed(2)).toBe("2350.00");
    expect(order?.items).toHaveLength(1);
    expect(order?.guestEmail).toBe("guest@e2e-chk.test");
  });

  test("a declined payment returns to the payment step with state preserved, and a retry succeeds", async ({ page }) => {
    await seedZones();
    const product = await seedProduct(2, "E2E Checkout Chilli Powder", "1000.00");
    await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 1 } });

    await page.goto("/checkout");
    await fillAddressStep(page);
    await page.getByRole("button", { name: "Continue to Payment" }).click();

    // Decline first.
    await page.getByRole("radio", { name: /Mock payment — Decline/ }).check();
    await page.getByRole("button", { name: "Pay now" }).click();
    await expect(page.getByText(/declined/i)).toBeVisible();
    // Still on the payment step — address/delivery state preserved.
    await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();

    // Retry with success.
    await page.getByRole("radio", { name: /Mock payment — Success/ }).check();
    await page.getByRole("button", { name: "Pay now" }).click();
    await expect(page.getByRole("heading", { name: "Review & Place Order" })).toBeVisible();
    await page.getByRole("button", { name: "Place Order" }).click();
    await page.waitForURL("**/checkout/confirmation/**");
    await expect(page.getByRole("heading", { name: "Thank you for your order!" })).toBeVisible();
  });

  test("crossing the free-shipping threshold shows Free delivery", async ({ page }) => {
    await seedZones();
    const product = await seedProduct(3, "E2E Checkout Gift Set", "4000.00");
    await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 2 } }); // 8000 > 7500 threshold

    await page.goto("/checkout");
    await fillAddressStep(page);

    await expect(page.getByText("You qualify for free shipping!")).toBeVisible();
    await expect(page.getByText("Free", { exact: true })).toBeVisible();
  });

  test("a city with no zone shows the fail-safe message and blocks progress", async ({ page }) => {
    await seedZones();
    const product = await seedProduct(4, "E2E Checkout No Zone Item", "1000.00");
    await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 1 } });

    await page.goto("/checkout");
    await page.getByLabel("Email address").fill("guest@e2e-chk.test");
    await page.getByLabel("Recipient name").fill("E2E Guest");
    await page.getByLabel("Phone number").fill("+94 77 123 4567");
    await page.getByLabel("Address line 1", { exact: true }).fill("42 Test Street");
    await page.getByLabel("City", { exact: true }).fill("Jaffna");
    await page.getByRole("button", { name: "Continue to Delivery" }).click();

    await expect(page.getByText(/We don't deliver to this city yet/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to Payment" })).toBeDisabled();
  });

  test("the checkout steps and confirmation page have no detectable accessibility violations", async ({ page }) => {
    await seedZones();
    const product = await seedProduct(5, "E2E Checkout A11y Item", "1000.00");
    await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 1 } });
    const { default: AxeBuilder } = await import("@axe-core/playwright");

    await page.goto("/checkout");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]); // Address step

    await fillAddressStep(page);
    await expect(page.getByText("E2E Western")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]); // Delivery step

    await page.getByRole("button", { name: "Continue to Payment" }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]); // Payment step

    await page.getByRole("radio", { name: /Mock payment — Success/ }).check();
    await page.getByRole("button", { name: "Pay now" }).click();
    await expect(page.getByRole("heading", { name: "Review & Place Order" })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]); // Review step

    await page.getByRole("button", { name: "Place Order" }).click();
    await page.waitForURL("**/checkout/confirmation/**");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]); // Confirmation
  });
});
