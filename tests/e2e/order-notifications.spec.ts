import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";

const SKU_PREFIX = "E2E-NTF-";
const ZONE_NAME = "E2E Notifications Zone";
const CITY = "E2E Notifications City";

async function seedZone() {
  await prisma.deliveryZone.create({
    data: {
      name: ZONE_NAME,
      cities: [CITY],
      rate: { create: { rateType: "Flat", flatAmount: "350.00", estimatedDaysMin: 1, estimatedDaysMax: 2 } },
    },
  });
}

async function seedProduct(price: string) {
  const product = await createProduct({
    sku: `${SKU_PREFIX}1`,
    slug: "e2e-ntf-product-1",
    name: "E2E Notifications Curry Powder",
    status: "Published",
    stockQuantity: 20,
    weightGrams: 150,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price } });
  return product;
}

async function placeGuestOrder(page: Page, productId: string): Promise<string> {
  await page.request.post("/api/cart/items", { data: { productId, quantity: 1 } });
  await page.goto("/checkout");
  await page.getByLabel("Email address").fill("guest@e2e-ntf.test");
  await page.getByLabel("Recipient name").fill("E2E Notifications Guest");
  await page.getByLabel("Phone number").fill("+94 77 123 4567");
  await page.getByLabel("Address line 1", { exact: true }).fill("42 Test Street");
  await page.getByLabel("City", { exact: true }).fill(CITY);
  await page.getByRole("button", { name: "Continue to Delivery" }).click();
  await page.getByRole("button", { name: "Continue to Payment" }).click();
  await page.getByRole("radio", { name: /Mock payment — Success/ }).check();
  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page.getByRole("heading", { name: "Review & Place Order" })).toBeVisible();
  await page.getByRole("button", { name: "Place Order" }).click();
  await page.waitForURL("**/checkout/confirmation/**");
  return page.url().split("/").pop()!;
}

test.describe("Order confirmation notifications (STORY-032)", () => {
  test.beforeEach(async () => {
    await prisma.notificationLog.deleteMany();
    await prisma.notificationTemplate.deleteMany({ where: { templateKey: "order.confirmed" } });
    await prisma.orderStatusHistory.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.deliveryZone.deleteMany({ where: { name: ZONE_NAME } });
    await prisma.standardPrice.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });

    await prisma.notificationTemplate.create({
      data: { templateKey: "order.confirmed", channel: "Email", subject: "Order {{orderNumber}} confirmed", body: "Total: {{currency}} {{grandTotal}}" },
    });
  });

  test("placing an order sends a real confirmation email through the dev sandbox adapter", async ({ page }) => {
    await seedZone();
    const product = await seedProduct("1000.00");

    const orderNumber = await placeGuestOrder(page, product.id);

    // The real EmailProvider (Ethereal sandbox, since no SMTP_HOST is
    // configured) runs here — this is the one test in the suite that
    // deliberately exercises the real network-backed adapter end to end.
    await expect
      .poll(async () => prisma.notificationLog.findFirst({ where: { recipient: "guest@e2e-ntf.test", templateKey: "order.confirmed" } }), {
        timeout: 15_000,
      })
      .toMatchObject({ status: "Sent", channel: "Email", userId: null });

    const log = await prisma.notificationLog.findFirstOrThrow({ where: { recipient: "guest@e2e-ntf.test", templateKey: "order.confirmed" } });
    expect(log.provider).toBe("ethereal");
    expect(log.providerReference).toBeTruthy();

    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber } });
    expect(order.guestEmail).toBe("guest@e2e-ntf.test");
  });
});
