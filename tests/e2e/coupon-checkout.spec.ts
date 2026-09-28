import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";

const SKU_PREFIX = "E2E-CPN-";
const CODE = "E2E-CPN-SAVE10";

async function seedProduct(n: number, name: string, price: string, stockQuantity = 20) {
  const product = await createProduct({
    sku: `${SKU_PREFIX}${n}`,
    slug: `e2e-cpn-product-${n}`,
    name,
    status: "Published",
    stockQuantity,
    weightGrams: 150,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price } });
  return product;
}

async function seedZoneAndCoupon() {
  await prisma.deliveryZone.create({
    data: {
      name: "E2E Coupon Zone",
      cities: ["E2E Coupon City"],
      rate: { create: { rateType: "Flat", flatAmount: "350.00", estimatedDaysMin: 1, estimatedDaysMax: 2 } },
    },
  });
  return prisma.coupon.create({
    data: {
      code: CODE,
      discountType: "PercentageOff",
      percentOff: "10",
      minOrderValue: "2000.00",
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}

async function fillAddressStep(page: Page) {
  await page.getByLabel("Email address").fill("guest@e2e-cpn.test");
  await page.getByLabel("Recipient name").fill("E2E Coupon Guest");
  await page.getByLabel("Phone number").fill("+94 77 123 4567");
  await page.getByLabel("Address line 1", { exact: true }).fill("42 Test Street");
  await page.getByLabel("City", { exact: true }).fill("E2E Coupon City");
  await page.getByRole("button", { name: "Continue to Delivery" }).click();
}

test.describe("Coupons at checkout (STORY-029)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.couponRedemption.deleteMany();
    await prisma.orderStatusHistory.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.deliveryZone.deleteMany({ where: { name: { startsWith: "E2E " } } });
    await prisma.coupon.deleteMany({ where: { code: CODE } });
    await prisma.standardPrice.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  });

  test("a coupon below its minimum is rejected with a specific reason, then applies once the cart crosses the threshold, and survives to the confirmation page", async ({ page }) => {
    await seedZoneAndCoupon();
    const product = await seedProduct(1, "E2E Coupon Curry Powder", "1000.00");

    await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 1 } }); // 1000, below the 2000 minimum
    await page.goto("/cart");

    await page.getByPlaceholder("Coupon code").fill(CODE);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("alert")).toContainText(/add.*more/i);

    // Cross the threshold.
    await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 1 } }); // now 2000
    await page.reload();
    await page.getByPlaceholder("Coupon code").fill(CODE);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(`Coupon ${CODE} applied`)).toBeVisible();
    await expect(page.getByText("−LKR 200.00")).toBeVisible(); // 10% of 2000

    // Proceed through checkout with the discount intact.
    await page.goto("/checkout");
    await fillAddressStep(page);
    await page.getByRole("button", { name: "Continue to Payment" }).click();
    await page.getByRole("radio", { name: /Mock payment — Success/ }).check();
    await page.getByRole("button", { name: "Pay now" }).click();

    await expect(page.getByRole("heading", { name: "Review & Place Order" })).toBeVisible();
    await expect(page.getByText(`Coupon ${CODE}`)).toBeVisible();
    // Subtotal 2000 - discount 200 + delivery 350 = 2150.
    await expect(page.getByText("LKR 2150.00")).toBeVisible();

    await page.getByRole("button", { name: "Place Order" }).click();
    await page.waitForURL("**/checkout/confirmation/**");
    await expect(page.getByRole("heading", { name: "Thank you for your order!" })).toBeVisible();
    await expect(page.getByText(`Coupon ${CODE}`)).toBeVisible();

    const order = await prisma.order.findFirst({ where: { couponCode: CODE } });
    expect(order?.discount.toFixed(2)).toBe("200.00");
    expect(order?.grandTotal.toFixed(2)).toBe("2150.00");

    const redemption = await prisma.couponRedemption.findFirst({ where: { orderId: order?.id } });
    expect(redemption?.discountAmount.toFixed(2)).toBe("200.00");
  });

  test("removing a coupon reverts the total", async ({ page }) => {
    await seedZoneAndCoupon();
    const product = await seedProduct(2, "E2E Coupon Chilli Powder", "2500.00");
    await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 1 } });

    await page.goto("/cart");
    await page.getByPlaceholder("Coupon code").fill(CODE);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText(`Coupon ${CODE} applied`)).toBeVisible();

    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByPlaceholder("Coupon code")).toBeVisible();
    await expect(page.getByText(`Coupon ${CODE} applied`)).not.toBeVisible();
  });
});
