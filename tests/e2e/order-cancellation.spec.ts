import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";

import { signInAs } from "./helpers/auth";

const SKU_PREFIX = "E2E-ORD-";
const EMAIL_DOMAIN = "@e2e-ord.test";

async function seedProduct(n: number, name: string, price: string, stockQuantity = 20) {
  const product = await createProduct({
    sku: `${SKU_PREFIX}${n}`,
    slug: `e2e-ord-product-${n}`,
    name,
    status: "Published",
    stockQuantity,
    weightGrams: 150,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price } });
  return product;
}

async function seedZone() {
  await prisma.deliveryZone.create({
    data: {
      name: "E2E Order Zone",
      cities: ["E2E Order City"],
      rate: { create: { rateType: "Flat", flatAmount: "350.00", estimatedDaysMin: 1, estimatedDaysMax: 2 } },
    },
  });
}

async function fillAddressStep(page: Page) {
  await page.getByLabel("Email address").fill("guest@e2e-ord.test");
  await page.getByLabel("Recipient name").fill("E2E Order Guest");
  await page.getByLabel("Phone number").fill("+94 77 123 4567");
  await page.getByLabel("Address line 1", { exact: true }).fill("42 Test Street");
  await page.getByLabel("City", { exact: true }).fill("E2E Order City");
  await page.getByRole("button", { name: "Continue to Delivery" }).click();
}

/** Places an order through the real checkout flow, landing on the confirmation page. */
async function placeOrder(page: Page, productId: string) {
  await page.request.post("/api/cart/items", { data: { productId, quantity: 2 } });
  await page.goto("/checkout");
  await fillAddressStep(page);
  await page.getByRole("button", { name: "Continue to Payment" }).click();
  await page.getByRole("radio", { name: /Mock payment — Success/ }).check();
  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page.getByRole("heading", { name: "Review & Place Order" })).toBeVisible();
  await page.getByRole("button", { name: "Place Order" }).click();
  await page.waitForURL("**/checkout/confirmation/**");
  const orderNumber = page.url().split("/").pop()!;
  return orderNumber;
}

/** STORY-030: same flow, but as a signed-in customer (no guest email field) — for the points clawback/tier-demotion assertion below. */
async function placeOrderAsUser(page: Page, productId: string) {
  await page.request.post("/api/cart/items", { data: { productId, quantity: 1 } });
  await page.goto("/checkout");
  await page.getByLabel("Recipient name").fill("E2E Order Customer");
  await page.getByLabel("Phone number").fill("+94 77 123 4567");
  await page.getByLabel("Address line 1", { exact: true }).fill("42 Test Street");
  await page.getByLabel("City", { exact: true }).fill("E2E Order City");
  await page.getByRole("button", { name: "Continue to Delivery" }).click();
  await page.getByRole("button", { name: "Continue to Payment" }).click();
  await page.getByRole("radio", { name: /Mock payment — Success/ }).check();
  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page.getByRole("heading", { name: "Review & Place Order" })).toBeVisible();
  await page.getByRole("button", { name: "Place Order" }).click();
  await page.waitForURL("**/checkout/confirmation/**");
  return page.url().split("/").pop()!;
}

test.describe("Order management (STORY-028)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.customerBadge.deleteMany();
    await prisma.rewardTransaction.deleteMany();
    await prisma.rewardAccount.deleteMany();
    await prisma.rewardTier.deleteMany({ where: { name: { startsWith: "E2E " } } });
    await prisma.orderStatusHistory.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.deliveryZone.deleteMany({ where: { name: { startsWith: "E2E " } } });
    await prisma.standardPrice.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("the confirmation page shows the order status pipeline", async ({ page }) => {
    await seedZone();
    const product = await seedProduct(1, "E2E Order Curry Powder", "1000.00");
    await placeOrder(page, product.id);

    await expect(page.getByRole("heading", { name: "Order status" })).toBeVisible();
    // Scoped to the pipeline list — "Confirmed" also appears in the collapsed status-history <details> below it.
    await expect(page.getByRole("list", { name: "Order status" }).getByText("Confirmed", { exact: true })).toBeVisible();
  });

  test("cancelling an eligible order restocks inventory and updates status", async ({ page }) => {
    await seedZone();
    const product = await seedProduct(2, "E2E Order Chilli Powder", "1000.00", 20);
    const orderNumber = await placeOrder(page, product.id);

    const afterPurchase = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(afterPurchase.stockQuantity).toBe(18); // 20 - 2 decremented at order placement

    const cancelResponse = await page.request.post(`/api/orders/${orderNumber}/cancel`, { data: { reason: "E2E test cancellation" } });
    expect(cancelResponse.ok()).toBe(true);
    const cancelBody = (await cancelResponse.json()) as { status: string; refundOutcome: string };
    expect(cancelBody.status).toBe("Cancelled");
    expect(cancelBody.refundOutcome).toBe("refunded");

    const restocked = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(restocked.stockQuantity).toBe(20);

    const detailResponse = await page.request.get(`/api/orders/${orderNumber}`);
    const detail = (await detailResponse.json()) as { status: string; statusHistory: Array<{ status: string }> };
    expect(detail.status).toBe("Cancelled");
    expect(detail.statusHistory.map((h) => h.status)).toEqual(["Confirmed", "Cancelled"]);
  });

  test("a stranger cannot cancel someone else's order", async ({ page, browser }) => {
    await seedZone();
    const product = await seedProduct(3, "E2E Order Gift Set", "1000.00");
    const orderNumber = await placeOrder(page, product.id);

    // A fresh browser context has no cart cookie linking it to this order.
    const strangerContext = await browser.newContext();
    const strangerPage = await strangerContext.newPage();
    const response = await strangerPage.request.post(`/api/orders/${orderNumber}/cancel`, { data: {} });
    expect(response.status()).toBe(403);
    await strangerContext.close();
  });

  test("cancelling an order claws back its reward points and can demote a tier (STORY-030)", async ({ page }) => {
    await seedZone();
    await prisma.rewardTier.createMany({
      data: [
        { name: "E2E Bronze", minLifetimePoints: 0, sortOrder: 1 },
        { name: "E2E Silver", minLifetimePoints: 100, sortOrder: 2 },
      ],
    });
    const product = await createProduct({
      sku: `${SKU_PREFIX}5`,
      slug: "e2e-ord-product-5",
      name: "E2E Order Reward Points Product",
      status: "Published",
      stockQuantity: 20,
      weightGrams: 150,
      rewardPoints: 100,
    });
    await prisma.standardPrice.create({ data: { productId: product.id, price: "1000.00" } });
    const user = await prisma.user.create({ data: { email: `customer${EMAIL_DOMAIN}`, name: "Order Cancel Tester" } });
    await signInAs(page, user.id);

    const orderNumber = await placeOrderAsUser(page, product.id);
    const balanceAfterOrder = await page.request.get("/api/rewards/balance");
    const afterOrderBody = (await balanceAfterOrder.json()) as { spendable: number; currentTier: { name: string } | null };
    expect(afterOrderBody.spendable).toBe(100);
    expect(afterOrderBody.currentTier?.name).toBe("E2E Silver");

    const cancelResponse = await page.request.post(`/api/orders/${orderNumber}/cancel`, { data: {} });
    expect(cancelResponse.ok()).toBe(true);

    const balanceAfterCancel = await page.request.get("/api/rewards/balance");
    const afterCancelBody = (await balanceAfterCancel.json()) as { spendable: number; currentTier: { name: string } | null };
    expect(afterCancelBody.spendable).toBe(0);
    expect(afterCancelBody.currentTier?.name).toBe("E2E Bronze");
  });
});
