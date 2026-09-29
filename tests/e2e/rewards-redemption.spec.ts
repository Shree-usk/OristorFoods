import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";

import { signInAs } from "./helpers/auth";

const SKU_PREFIX = "E2E-RWD-";
const EMAIL_DOMAIN = "@e2e-rwd.test";
const ZONE_NAME = "E2E Rewards Zone";
const CITY = "E2E Rewards City";

async function seedZone() {
  await prisma.deliveryZone.create({
    data: {
      name: ZONE_NAME,
      cities: [CITY],
      rate: { create: { rateType: "Flat", flatAmount: "350.00", estimatedDaysMin: 1, estimatedDaysMax: 2 } },
    },
  });
}

async function seedProduct(n: number, name: string, price: string, rewardPoints: number) {
  const product = await createProduct({
    sku: `${SKU_PREFIX}${n}`,
    slug: `e2e-rwd-product-${n}`,
    name,
    status: "Published",
    stockQuantity: 20,
    weightGrams: 150,
    rewardPoints,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price } });
  return product;
}

async function fillAuthenticatedAddressStep(page: Page) {
  await page.getByLabel("Recipient name").fill("E2E Rewards Customer");
  await page.getByLabel("Phone number").fill("+94 77 123 4567");
  await page.getByLabel("Address line 1", { exact: true }).fill("42 Test Street");
  await page.getByLabel("City", { exact: true }).fill(CITY);
  await page.getByRole("button", { name: "Continue to Delivery" }).click();
}

/** Places an order through the real checkout flow as a signed-in customer, optionally redeeming reward points at the Review step. */
async function placeOrderAsUser(page: Page, productId: string, redeemPoints?: number): Promise<string> {
  await page.request.post("/api/cart/items", { data: { productId, quantity: 1 } });
  await page.goto("/checkout");
  await fillAuthenticatedAddressStep(page);
  await page.getByRole("button", { name: "Continue to Payment" }).click();
  await page.getByRole("radio", { name: /Mock payment — Success/ }).check();
  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page.getByRole("heading", { name: "Review & Place Order" })).toBeVisible();

  if (redeemPoints) {
    const pointsForm = page.locator("form", { has: page.getByLabel("Reward points to redeem") });
    await pointsForm.getByLabel("Reward points to redeem").fill(String(redeemPoints));
    await pointsForm.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(`${redeemPoints} reward points applied`)).toBeVisible();
  }

  const [firstAttempt] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/checkout/place-order")),
    page.getByRole("button", { name: "Place Order" }).click(),
  ]);

  // Applying points changes the grand total without resetting the
  // already-confirmed payment intent (documented in review-step.tsx) — so
  // place-order's totals_changed handling (409) bounces the customer back
  // to Payment with a fresh total. Re-confirm and place once more in that case.
  if (firstAttempt.status() === 409) {
    await expect(page.getByRole("heading", { name: "Payment" })).toBeVisible();
    await page.getByRole("radio", { name: /Mock payment — Success/ }).check();
    await page.getByRole("button", { name: "Pay now" }).click();
    await expect(page.getByRole("heading", { name: "Review & Place Order" })).toBeVisible();
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/checkout/place-order") && response.status() < 400),
      page.getByRole("button", { name: "Place Order" }).click(),
    ]);
  }

  await page.waitForURL("**/checkout/confirmation/**");
  return page.url().split("/").pop()!;
}

test.describe("Rewards / Loyalty Club redemption (STORY-030)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.customerBadge.deleteMany();
    await prisma.rewardTransaction.deleteMany();
    await prisma.rewardAccount.deleteMany();
    await prisma.rewardSetting.deleteMany({ where: { id: "global" } });
    await prisma.orderStatusHistory.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.deliveryZone.deleteMany({ where: { name: ZONE_NAME } });
    await prisma.standardPrice.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });

    // Redemption is off by default — this suite turns it on with a simple 1:1 rate, no cap, no expiry.
    await prisma.rewardSetting.create({ data: { id: "global", pointsToCurrencyRate: "1.0000" } });
  });

  test("earning on order confirmation and redeeming on a later order both land correctly", async ({ page }) => {
    await seedZone();
    const earningProduct = await seedProduct(1, "E2E Rewards Curry Powder", "1000.00", 100);
    const spendingProduct = await seedProduct(2, "E2E Rewards Chilli Powder", "500.00", 0);
    const user = await prisma.user.create({ data: { email: `customer${EMAIL_DOMAIN}`, name: "Rewards Tester" } });
    await signInAs(page, user.id);

    // Order 1 earns 100 points, credited via the order.confirmed hook.
    await placeOrderAsUser(page, earningProduct.id);
    const balanceAfterFirst = await page.request.get("/api/rewards/balance");
    expect((await balanceAfterFirst.json()).spendable).toBe(100);

    // Order 2 redeems 50 of those points against a product that itself earns none, keeping the math simple.
    const secondOrderNumber = await placeOrderAsUser(page, spendingProduct.id, 50);

    const orderDetail = await page.request.get(`/api/orders/${secondOrderNumber}`);
    const orderBody = (await orderDetail.json()) as { pointsRedeemed: number; pointsRedemptionValue: number; grandTotal: number };
    expect(orderBody.pointsRedeemed).toBe(50);
    expect(orderBody.pointsRedemptionValue).toBe(50);
    expect(orderBody.grandTotal).toBe(800); // 500 subtotal + 350 delivery - 50 points

    const balanceAfterSecond = await page.request.get("/api/rewards/balance");
    expect((await balanceAfterSecond.json()).spendable).toBe(50); // 100 earned - 50 redeemed
  });
});
