// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { registerOrderEventConsumer, resetOrderEventConsumerForTesting } from "@/services/order-integration.service";
import { cancelOrder, createOrder } from "@/services/order.service";
import { rewardsConsumer } from "@/services/rewards.service";
import {
  attributeReferralAtRegistration,
  getOrCreateReferralCode,
  getReferralStatusForUser,
  referralConsumer,
} from "@/services/referral.service";
import { signReferralToken } from "@/lib/referral-token";
import { REFERRAL_COOKIE_NAME } from "@/lib/api/referral-cookie";
import type { CreateOrderInput } from "@/repositories/order.repository";

const EMAIL_PREFIX = "rfl-svc-";
const SKU_PREFIX = "RFL-SVC-SKU-";
let sequence = 0;

async function makeUser(email?: string) {
  sequence += 1;
  return prisma.user.create({ data: { email: email ?? `${EMAIL_PREFIX}${sequence}@test.com` } });
}

async function makeProduct(stockQuantity = 10) {
  sequence += 1;
  return createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `rfl-svc-product-${sequence}`,
    name: `Referral Svc Product ${sequence}`,
    status: "Published",
    stockQuantity,
    rewardPoints: 10,
  });
}

async function makePayment(amount: string) {
  sequence += 1;
  return prisma.payment.create({
    data: { provider: "mock", providerReference: `mock_rfl-svc-${sequence}`, status: "Succeeded", amount, currency: "LKR" },
  });
}

function orderInput(
  overrides: Partial<Omit<CreateOrderInput, "orderNumber">> & Pick<Omit<CreateOrderInput, "orderNumber">, "userId" | "idempotencyKey" | "paymentId" | "cartId" | "items" | "subtotal" | "grandTotal">,
): Omit<CreateOrderInput, "orderNumber"> {
  return {
    guestToken: null,
    guestEmail: null,
    discount: "0.00",
    couponCode: null,
    discountLabel: null,
    couponRedemption: null,
    pointsRedeemed: 0,
    pointsRedemptionValue: "0.00",
    pointsRedemption: null,
    deliveryCharge: "0.00",
    rewardPointsEarned: 10,
    deliveryZoneName: "Western",
    estimatedDaysMin: 1,
    estimatedDaysMax: 3,
    shipRecipientName: "Test",
    shipPhone: "+94 77 000 0000",
    shipLine1: "1 Test Lane",
    shipLine2: null,
    shipCity: "Colombo",
    shipDistrict: null,
    shipPostalCode: null,
    ...overrides,
  };
}

function lineFor(product: { id: string; name: string; sku: string }, unitPrice: string, quantity = 1) {
  return {
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    unitPrice,
    quantity,
    lineTotal: (Number(unitPrice) * quantity).toFixed(2),
    rewardPointsEarned: quantity,
  };
}

/** Places an order for `userId` via the real service, so the real order.confirmed event fires. */
async function placeOrderFor(userId: string, subtotal: string) {
  const product = await makeProduct();
  const payment = await makePayment(subtotal);
  const cart = await prisma.cart.create({ data: {} });
  return createOrder(
    orderInput({
      userId,
      idempotencyKey: crypto.randomUUID(),
      paymentId: payment.id,
      cartId: cart.id,
      subtotal,
      grandTotal: subtotal,
      items: [lineFor(product, subtotal)],
    }),
  );
}

async function cleanupReferralTables() {
  await prisma.rewardTransaction.deleteMany();
  await prisma.rewardAccount.deleteMany();
  await prisma.referralAttribution.deleteMany();
  await prisma.referralCode.deleteMany();
  await prisma.referralSetting.deleteMany({ where: { id: "global" } });
}

beforeEach(async () => {
  await cleanupReferralTables();
});

afterEach(async () => {
  resetOrderEventConsumerForTesting();
  await cleanupReferralTables();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "mock_rfl-svc-" } } });
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
});

describe("getOrCreateReferralCode", () => {
  it("generates a code and returns the same one on a second call", async () => {
    const user = await makeUser();
    const first = await getOrCreateReferralCode(user.id);
    const second = await getOrCreateReferralCode(user.id);
    expect(first).toBe(second);
  });

  it("gives distinct users distinct codes", async () => {
    const a = await makeUser();
    const b = await makeUser();
    expect(await getOrCreateReferralCode(a.id)).not.toBe(await getOrCreateReferralCode(b.id));
  });
});

describe("attributeReferralAtRegistration", () => {
  function requestWithCookie(cookieValue: string) {
    return new Request("http://localhost/api/auth/register", { headers: { cookie: `${REFERRAL_COOKIE_NAME}=${cookieValue}` } });
  }

  it("creates a Registered attribution for a valid, in-window code", async () => {
    const referrer = await makeUser();
    const code = await getOrCreateReferralCode(referrer.id);
    const newUser = await makeUser();

    await attributeReferralAtRegistration({ id: newUser.id, email: newUser.email }, requestWithCookie(await signReferralToken(code)));

    const attribution = await prisma.referralAttribution.findUnique({ where: { referredUserId: newUser.id } });
    expect(attribution).toMatchObject({ referrerUserId: referrer.id, status: "Registered" });
  });

  it("silently does nothing for an unknown code — no attribution, no throw", async () => {
    const newUser = await makeUser();
    await expect(
      attributeReferralAtRegistration({ id: newUser.id, email: newUser.email }, requestWithCookie(await signReferralToken("UNKNOWNCODE"))),
    ).resolves.toBeUndefined();
    expect(await prisma.referralAttribution.findUnique({ where: { referredUserId: newUser.id } })).toBeNull();
  });

  it("silently does nothing when the attribution window has elapsed", async () => {
    // A 0-day window means any elapsed time at all counts as expired —
    // the simplest deterministic way to exercise this without needing to
    // forge a stale, still-correctly-signed token.
    await prisma.referralSetting.create({ data: { id: "global", attributionWindowDays: 0 } });
    const referrer = await makeUser();
    const code = await getOrCreateReferralCode(referrer.id);
    const newUser = await makeUser();

    const token = await signReferralToken(code);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await attributeReferralAtRegistration({ id: newUser.id, email: newUser.email }, requestWithCookie(token));

    expect(await prisma.referralAttribution.findUnique({ where: { referredUserId: newUser.id } })).toBeNull();
  });

  it("excludes a self-referral (same email) from payout but still records it", async () => {
    const sharedEmail = `${EMAIL_PREFIX}shared-self@test.com`;
    const referrer = await makeUser(sharedEmail);
    const code = await getOrCreateReferralCode(referrer.id);
    // Same email, different user row — the only way self-referral is realistically reachable, given User.email's own uniqueness.
    const selfReferredUser = { id: (await makeUser()).id, email: sharedEmail };

    await attributeReferralAtRegistration(selfReferredUser, requestWithCookie(await signReferralToken(code)));

    const attribution = await prisma.referralAttribution.findUnique({ where: { referredUserId: selfReferredUser.id } });
    expect(attribution).toMatchObject({ status: "Excluded", excludedReason: "self_referral" });
  });
});

describe("referralConsumer — qualifying order and payout", () => {
  it("qualifies on the referred customer's confirmed order and pays the referrer once", async () => {
    await prisma.referralSetting.create({ data: { id: "global", referrerBonusPoints: 100 } });
    registerOrderEventConsumer(referralConsumer);

    const referrer = await makeUser();
    const referred = await makeUser();
    await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: referred.id, status: "Registered" } });

    await placeOrderFor(referred.id, "1000.00");

    const attribution = await prisma.referralAttribution.findUniqueOrThrow({ where: { referredUserId: referred.id } });
    expect(attribution.status).toBe("Qualified");

    const bonus = await prisma.rewardTransaction.findFirst({ where: { userId: referrer.id, type: "ReferralBonus" } });
    expect(bonus?.points).toBe(100);
  });

  it("does not qualify below the configured minimum order value", async () => {
    await prisma.referralSetting.create({ data: { id: "global", referrerBonusPoints: 100, minQualifyingOrderValue: "2000.00" } });
    registerOrderEventConsumer(referralConsumer);

    const referrer = await makeUser();
    const referred = await makeUser();
    await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: referred.id, status: "Registered" } });

    await placeOrderFor(referred.id, "500.00");

    const attribution = await prisma.referralAttribution.findUniqueOrThrow({ where: { referredUserId: referred.id } });
    expect(attribution.status).toBe("Registered");
    expect(await prisma.rewardTransaction.findFirst({ where: { userId: referrer.id, type: "ReferralBonus" } })).toBeNull();
  });

  it("a second qualifying order for the same referred customer never pays out twice", async () => {
    await prisma.referralSetting.create({ data: { id: "global", referrerBonusPoints: 100 } });
    registerOrderEventConsumer(referralConsumer);

    const referrer = await makeUser();
    const referred = await makeUser();
    await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: referred.id, status: "Registered" } });

    await placeOrderFor(referred.id, "1000.00");
    await placeOrderFor(referred.id, "1000.00");

    const bonuses = await prisma.rewardTransaction.findMany({ where: { userId: referrer.id, type: "ReferralBonus" } });
    expect(bonuses).toHaveLength(1);
  });

  it("reverses the bonus on cancellation without colliding with the referred customer's own points clawback on the same order", async () => {
    await prisma.referralSetting.create({ data: { id: "global", referrerBonusPoints: 100 } });
    registerOrderEventConsumer(rewardsConsumer);
    registerOrderEventConsumer(referralConsumer);

    const referrer = await makeUser();
    const referred = await makeUser();
    await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: referred.id, status: "Registered" } });

    const { order } = await placeOrderFor(referred.id, "1000.00");

    // Sanity: the referred customer earned their own points on this order, and the referrer got the bonus.
    expect(await prisma.rewardTransaction.findFirst({ where: { userId: referred.id, type: "Earned", orderId: order.id } })).not.toBeNull();
    expect(await prisma.rewardTransaction.findFirst({ where: { userId: referrer.id, type: "ReferralBonus", orderId: order.id } })).not.toBeNull();

    await cancelOrder(order.orderNumber, referred.id, null, undefined);

    // Both reversals landed on the SAME orderId without a unique-constraint collision.
    const referredReversed = await prisma.rewardTransaction.findFirst({ where: { userId: referred.id, type: "Reversed", orderId: order.id } });
    const referrerReversed = await prisma.rewardTransaction.findFirst({ where: { userId: referrer.id, type: "ReferralBonusReversed", orderId: order.id } });
    expect(referredReversed?.points).toBe(-10);
    expect(referrerReversed?.points).toBe(-100);

    const attribution = await prisma.referralAttribution.findUniqueOrThrow({ where: { referredUserId: referred.id } });
    expect(attribution.status).toBe("Registered");
    expect(attribution.qualifyingOrderId).toBeNull();
  });

  it("no-ops for a guest order (no userId)", async () => {
    registerOrderEventConsumer(referralConsumer);
    const product = await makeProduct();
    const payment = await makePayment("1000.00");
    const cart = await prisma.cart.create({ data: { guestToken: `rfl-svc-guest-${++sequence}` } });

    await expect(
      createOrder(
        orderInput({
          userId: null,
          guestToken: cart.guestToken,
          guestEmail: "guest@test.com",
          idempotencyKey: crypto.randomUUID(),
          paymentId: payment.id,
          cartId: cart.id,
          subtotal: "1000.00",
          grandTotal: "1000.00",
          items: [lineFor(product, "1000.00")],
        }),
      ),
    ).resolves.toBeDefined();
  });
});

describe("getReferralStatusForUser", () => {
  it("lists this referrer's referrals with status", async () => {
    const referrer = await makeUser();
    const referredA = await makeUser();
    const referredB = await makeUser();
    await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: referredA.id, status: "Registered" } });
    await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: referredB.id, status: "Qualified", qualifiedAt: new Date() } });

    const status = await getReferralStatusForUser(referrer.id);
    expect(status).toHaveLength(2);
    expect(status.map((s) => s.status).sort()).toEqual(["Qualified", "Registered"]);
  });
});
