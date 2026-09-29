import { expect, test, type Page } from "@playwright/test";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { getOrCreateReferralCode } from "@/services/referral.service";

const SKU_PREFIX = "E2E-RFL-";
const EMAIL_DOMAIN = "@e2e-rfl.test";
const ZONE_NAME = "E2E Referral Zone";
const CITY = "E2E Referral City";

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
    slug: "e2e-rfl-product-1",
    name: "E2E Referral Curry Powder",
    status: "Published",
    stockQuantity: 20,
    weightGrams: 150,
  });
  await prisma.standardPrice.create({ data: { productId: product.id, price } });
  return product;
}

async function placeQualifyingOrder(page: Page, productId: string): Promise<string> {
  await page.request.post("/api/cart/items", { data: { productId, quantity: 1 } });
  await page.goto("/checkout");
  await page.getByLabel("Recipient name").fill("E2E Referral Customer");
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

test.describe("Referral Programme signup and payout (STORY-031)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.rewardTransaction.deleteMany();
    await prisma.rewardAccount.deleteMany();
    await prisma.referralAttribution.deleteMany();
    await prisma.referralCode.deleteMany();
    await prisma.referralSetting.deleteMany({ where: { id: "global" } });
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

    await prisma.referralSetting.create({ data: { id: "global", referrerBonusPoints: 50 } });
  });

  test("visiting via a referral link, registering, and placing a qualifying order pays the referrer", async ({ page }) => {
    await seedZone();
    const product = await seedProduct("1000.00");
    const referrer = await prisma.user.create({ data: { email: `referrer${EMAIL_DOMAIN}`, name: "Referrer" } });
    const code = await getOrCreateReferralCode(referrer.id);

    // Land via the referral link — middleware should set the attribution cookie.
    await page.goto(`/?ref=${code}`);

    await page.goto("/account/register");
    const referredEmail = `referred${EMAIL_DOMAIN}`;
    await page.getByLabel("Email address").fill(referredEmail);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("http://localhost:3000/");

    const referred = await prisma.user.findUniqueOrThrow({ where: { email: referredEmail } });
    const attributionAfterSignup = await prisma.referralAttribution.findUniqueOrThrow({ where: { referredUserId: referred.id } });
    expect(attributionAfterSignup).toMatchObject({ referrerUserId: referrer.id, status: "Registered" });

    await placeQualifyingOrder(page, product.id);

    const attributionAfterOrder = await prisma.referralAttribution.findUniqueOrThrow({ where: { referredUserId: referred.id } });
    expect(attributionAfterOrder.status).toBe("Qualified");

    const bonus = await prisma.rewardTransaction.findFirstOrThrow({ where: { userId: referrer.id, type: "ReferralBonus" } });
    expect(bonus.points).toBe(50);
  });
});
