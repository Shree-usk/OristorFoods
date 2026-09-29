// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockEmailSend } = vi.hoisted(() => ({ mockEmailSend: vi.fn() }));

// STORY-032: creditPointsForConfirmedOrder now sends a notification on a
// genuine credit — mocked here so these tests never touch the network.
vi.mock("@/services/notification/email.provider", () => ({
  EmailProvider: class {
    name = "mock-email-for-test";
    send = mockEmailSend;
  },
}));

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createOrderWithStockDecrement } from "@/repositories/order.repository";
import type { CreateOrderInput } from "@/repositories/order.repository";
import { InsufficientStockError } from "@/services/order.errors";
import {
  applyPointsToCart,
  creditPointsForConfirmedOrder,
  getBalanceForUser,
  removePointsFromCart,
  resolvePointsRedemptionForCart,
  reversePointsForCancelledOrder,
  validateRedemptionAtPlaceOrder,
} from "@/services/rewards.service";
import {
  RewardsExceedsPerOrderCapError,
  RewardsInsufficientBalanceError,
  RewardsInvalidAmountError,
  RewardsNotAuthenticatedError,
  RewardsRedemptionUnavailableError,
} from "@/services/rewards.errors";

const EMAIL_PREFIX = "rwd-svc-";
const SKU_PREFIX = "RWD-SVC-SKU-";
let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `${EMAIL_PREFIX}${sequence}@test.com` } });
}

async function makeProduct(stockQuantity = 10) {
  sequence += 1;
  return createProduct({
    sku: `${SKU_PREFIX}${sequence}`,
    slug: `rwd-svc-product-${sequence}`,
    name: `Rewards Svc Product ${sequence}`,
    status: "Published",
    stockQuantity,
  });
}

async function makePayment(amount: string) {
  sequence += 1;
  return prisma.payment.create({
    data: { provider: "mock", providerReference: `mock_rwd-svc-${sequence}`, status: "Succeeded", amount, currency: "LKR" },
  });
}

async function makeOrder(userId: string | null = null) {
  sequence += 1;
  return prisma.order.create({
    data: {
      orderNumber: `ORS-RWD-SVC-${sequence}`,
      idempotencyKey: `rwd-svc-idem-${sequence}`,
      userId,
      guestEmail: userId ? null : `${EMAIL_PREFIX}guest-${sequence}@test.com`,
      status: "Confirmed",
      subtotal: "1000.00",
      deliveryCharge: "0.00",
      grandTotal: "1000.00",
      deliveryZoneName: "Western",
      shipRecipientName: "Test",
      shipPhone: "+94 77 000 0000",
      shipLine1: "1 Test Lane",
      shipCity: "Colombo",
    },
  });
}

async function makeTier(name: string, minLifetimePoints: number, sortOrder: number) {
  return prisma.rewardTier.create({ data: { name: `${EMAIL_PREFIX}${name}`, minLifetimePoints, sortOrder } });
}

async function makeBadge(code: string, criteriaType: string, threshold: number | null = null) {
  return prisma.badge.create({ data: { code: `${EMAIL_PREFIX}${code}`, name: code, criteriaType, threshold } });
}

async function cleanupRewardsTables() {
  await prisma.customerBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.rewardTransaction.deleteMany();
  await prisma.rewardAccount.deleteMany();
  await prisma.rewardTier.deleteMany();
  await prisma.rewardSetting.deleteMany({ where: { id: "global" } });
}

beforeEach(async () => {
  // This suite owns the entire rewards domain end to end — start every
  // test from a clean slate regardless of any ambient seed data (tier
  // evaluation reads ALL active RewardTier rows, unscoped by design).
  await cleanupRewardsTables();
  mockEmailSend.mockReset();
  mockEmailSend.mockResolvedValue({ status: "sent", providerReference: "mock-email-ref" });
});

afterEach(async () => {
  await cleanupRewardsTables();
  await prisma.notificationLog.deleteMany();
  await prisma.notificationTemplate.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: "ORS-RWD-SVC-" } } });
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "mock_rwd-svc-" } } });
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
});

describe("creditPointsForConfirmedOrder", () => {
  it("writes an Earned transaction for the order's points", async () => {
    const user = await makeUser();
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 50);

    const rows = await prisma.rewardTransaction.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "Earned", points: 50, orderId: order.id });
  });

  it("sends a points_earned notification on a genuine credit, and never twice for a replayed event (STORY-032)", async () => {
    await prisma.notificationTemplate.create({ data: { templateKey: "rewards.points_earned", channel: "Email", subject: "s", body: "You earned {{points}}" } });
    const user = await makeUser();
    const order = await makeOrder(user.id);

    await creditPointsForConfirmedOrder(order.id, user.id, 50);
    await creditPointsForConfirmedOrder(order.id, user.id, 50); // replay

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    expect(mockEmailSend).toHaveBeenCalledWith(user.email, "s", "You earned 50");
    const logs = await prisma.notificationLog.findMany({ where: { userId: user.id, templateKey: "rewards.points_earned", channel: "Email" } });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("Sent");
  });

  it("is idempotent — a replayed event for the same order writes only one Earned row", async () => {
    const user = await makeUser();
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 50);
    await creditPointsForConfirmedOrder(order.id, user.id, 50);

    const rows = await prisma.rewardTransaction.findMany({ where: { userId: user.id, type: "Earned" } });
    expect(rows).toHaveLength(1);
  });

  it("does nothing for zero points but still runs badge evaluation", async () => {
    const user = await makeUser();
    const order = await makeOrder(user.id);
    await makeBadge("first-order-zero", "first_order");

    await creditPointsForConfirmedOrder(order.id, user.id, 0);

    const transactions = await prisma.rewardTransaction.findMany({ where: { userId: user.id } });
    expect(transactions).toHaveLength(0);
    const badges = await prisma.customerBadge.findMany({ where: { userId: user.id } });
    expect(badges).toHaveLength(1);
  });
});

describe("reversePointsForCancelledOrder", () => {
  it("writes a Reversed transaction that nets the Earned amount to zero", async () => {
    const user = await makeUser();
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 80);

    await reversePointsForCancelledOrder(order.id, user.id);

    const balance = await getBalanceForUser(user.id);
    expect(balance.spendable).toBe(0);
    expect(balance.lifetimeAchievement).toBe(0);
  });

  it("is a no-op when the order never earned any points", async () => {
    const user = await makeUser();
    const order = await makeOrder(user.id);

    await reversePointsForCancelledOrder(order.id, user.id);

    const rows = await prisma.rewardTransaction.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(0);
  });

  it("is idempotent — reversing twice writes only one Reversed row", async () => {
    const user = await makeUser();
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 80);

    await reversePointsForCancelledOrder(order.id, user.id);
    await reversePointsForCancelledOrder(order.id, user.id);

    const rows = await prisma.rewardTransaction.findMany({ where: { userId: user.id, type: "Reversed" } });
    expect(rows).toHaveLength(1);
  });
});

describe("tier evaluation", () => {
  it("assigns a tier exactly at its minLifetimePoints boundary, not one point under", async () => {
    await makeTier("bronze", 0, 1);
    await makeTier("silver", 1000, 2);
    const user = await makeUser();

    const justUnder = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(justUnder.id, user.id, 999);
    let balance = await getBalanceForUser(user.id);
    expect(balance.currentTier?.name).toBe(`${EMAIL_PREFIX}bronze`);

    const overTheLine = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(overTheLine.id, user.id, 1);
    balance = await getBalanceForUser(user.id);
    expect(balance.currentTier?.name).toBe(`${EMAIL_PREFIX}silver`);
  });

  it("clawback on cancellation can demote a tier, since it lowers lifetimeAchievement", async () => {
    await makeTier("bronze", 0, 1);
    await makeTier("silver", 1000, 2);
    const user = await makeUser();
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 1200);

    let balance = await getBalanceForUser(user.id);
    expect(balance.currentTier?.name).toBe(`${EMAIL_PREFIX}silver`);

    await reversePointsForCancelledOrder(order.id, user.id);
    balance = await getBalanceForUser(user.id);
    expect(balance.currentTier?.name).toBe(`${EMAIL_PREFIX}bronze`);
  });
});

describe("badge awarding", () => {
  it("awards the first_order badge on the customer's first confirmed order", async () => {
    await makeBadge("first-order", "first_order");
    const user = await makeUser();
    const order = await makeOrder(user.id);

    await creditPointsForConfirmedOrder(order.id, user.id, 10);

    const badges = await prisma.customerBadge.findMany({ where: { userId: user.id } });
    expect(badges).toHaveLength(1);
  });

  it("awards an order_count badge only once the threshold is reached, and never twice", async () => {
    await makeBadge("loyal", "order_count", 2);
    const user = await makeUser();

    const first = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(first.id, user.id, 10);
    expect(await prisma.customerBadge.findMany({ where: { userId: user.id } })).toHaveLength(0);

    const second = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(second.id, user.id, 10);
    expect(await prisma.customerBadge.findMany({ where: { userId: user.id } })).toHaveLength(1);

    const third = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(third.id, user.id, 10);
    expect(await prisma.customerBadge.findMany({ where: { userId: user.id } })).toHaveLength(1); // not double-awarded
  });

  it("does not revoke a badge when the order that triggered it is later cancelled", async () => {
    await makeBadge("first-order-keep", "first_order");
    const user = await makeUser();
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 10);
    expect(await prisma.customerBadge.findMany({ where: { userId: user.id } })).toHaveLength(1);

    await reversePointsForCancelledOrder(order.id, user.id);
    expect(await prisma.customerBadge.findMany({ where: { userId: user.id } })).toHaveLength(1);
  });
});

describe("redemption validation", () => {
  it("resolvePointsRedemptionForCart silently returns zero for a guest (no userId)", async () => {
    const result = await resolvePointsRedemptionForCart(null, 100, 1000);
    expect(result).toEqual({ pointsToRedeem: 0, discountValue: 0 });
  });

  it("resolvePointsRedemptionForCart silently returns zero when redemption isn't configured", async () => {
    const user = await makeUser();
    const result = await resolvePointsRedemptionForCart(user.id, 100, 1000);
    expect(result).toEqual({ pointsToRedeem: 0, discountValue: 0 });
  });

  it("validateRedemptionAtPlaceOrder throws RewardsRedemptionUnavailableError when no rate is configured", async () => {
    const user = await makeUser();
    await expect(validateRedemptionAtPlaceOrder(user.id, 100, 1000)).rejects.toBeInstanceOf(RewardsRedemptionUnavailableError);
  });

  it("validateRedemptionAtPlaceOrder throws RewardsInsufficientBalanceError over the balance", async () => {
    await prisma.rewardSetting.create({ data: { id: "global", pointsToCurrencyRate: "1.0000" } });
    const user = await makeUser();
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 50);

    await expect(validateRedemptionAtPlaceOrder(user.id, 100, 1000)).rejects.toBeInstanceOf(RewardsInsufficientBalanceError);
  });

  it("validateRedemptionAtPlaceOrder throws RewardsExceedsPerOrderCapError over the cap", async () => {
    await prisma.rewardSetting.create({ data: { id: "global", pointsToCurrencyRate: "1.0000", maxRedeemablePointsPerOrder: 20 } });
    const user = await makeUser();
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 500);

    await expect(validateRedemptionAtPlaceOrder(user.id, 100, 1000)).rejects.toBeInstanceOf(RewardsExceedsPerOrderCapError);
  });

  it("validateRedemptionAtPlaceOrder succeeds and returns the clamped calculation within bounds", async () => {
    await prisma.rewardSetting.create({ data: { id: "global", pointsToCurrencyRate: "1.0000" } });
    const user = await makeUser();
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 500);

    const result = await validateRedemptionAtPlaceOrder(user.id, 100, 1000);
    expect(result).toEqual({ pointsToRedeem: 100, discountValue: 100 });
  });
});

describe("applyPointsToCart / removePointsFromCart", () => {
  it("throws RewardsNotAuthenticatedError for a guest", async () => {
    await expect(applyPointsToCart(null, 50)).rejects.toBeInstanceOf(RewardsNotAuthenticatedError);
    await expect(removePointsFromCart(null)).rejects.toBeInstanceOf(RewardsNotAuthenticatedError);
  });

  it("throws RewardsInvalidAmountError for a non-positive or fractional amount", async () => {
    const user = await makeUser();
    await expect(applyPointsToCart(user.id, 0)).rejects.toBeInstanceOf(RewardsInvalidAmountError);
    await expect(applyPointsToCart(user.id, -5)).rejects.toBeInstanceOf(RewardsInvalidAmountError);
  });

  it("sets the cart's pointsToRedeem and reflects it in the returned summary", async () => {
    await prisma.rewardSetting.create({ data: { id: "global", pointsToCurrencyRate: "1.0000" } });
    const user = await makeUser();
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 200);
    await prisma.cart.create({ data: { userId: user.id } });

    const summary = await applyPointsToCart(user.id, 50);
    expect(summary.pointsRedemption).toBeNull(); // no items in cart -> payable is 0, calc yields zero

    const cart = await prisma.cart.findUniqueOrThrow({ where: { userId: user.id } });
    expect(cart.pointsToRedeem).toBe(50);

    const removed = await removePointsFromCart(user.id);
    expect(removed.pointsRedemption).toBeNull();
    const clearedCart = await prisma.cart.findUniqueOrThrow({ where: { userId: user.id } });
    expect(clearedCart.pointsToRedeem).toBe(0);
  });
});

describe("expiry sweep", () => {
  it("closes an expired Earned batch with an Expired row, reducing the spendable balance", async () => {
    await prisma.rewardSetting.create({ data: { id: "global", pointsToCurrencyRate: "1.0000", pointsExpiryDays: 30 } });
    const user = await makeUser();
    const order = await makeOrder(user.id);
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.rewardTransaction.create({ data: { userId: user.id, type: "Earned", points: 100, orderId: order.id, expiresAt: past } });

    const balance = await getBalanceForUser(user.id);
    expect(balance.spendable).toBe(0);

    const expired = await prisma.rewardTransaction.findMany({ where: { userId: user.id, type: "Expired" } });
    expect(expired).toHaveLength(1);
    expect(expired[0].points).toBe(-100);
  });

  it("caps the expired amount at the current spendable balance when part of the batch was already redeemed", async () => {
    await prisma.rewardSetting.create({ data: { id: "global", pointsToCurrencyRate: "1.0000", pointsExpiryDays: 30 } });
    const user = await makeUser();
    const earnOrder = await makeOrder(user.id);
    const redeemOrder = await makeOrder(user.id);
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.rewardTransaction.create({ data: { userId: user.id, type: "Earned", points: 100, orderId: earnOrder.id, expiresAt: past } });
    await prisma.rewardTransaction.create({ data: { userId: user.id, type: "Redeemed", points: -40, orderId: redeemOrder.id } });

    const balance = await getBalanceForUser(user.id);
    expect(balance.spendable).toBe(0); // capped at 60, not driven negative by expiring the full 100

    const expired = await prisma.rewardTransaction.findMany({ where: { userId: user.id, type: "Expired" } });
    expect(expired[0].points).toBe(-60);
  });

  it("does nothing when no Earned rows have an expiresAt in the past", async () => {
    const user = await makeUser();
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 50); // no pointsExpiryDays configured -> expiresAt null

    const balance = await getBalanceForUser(user.id);
    expect(balance.spendable).toBe(50);
    expect(await prisma.rewardTransaction.findMany({ where: { userId: user.id, type: "Expired" } })).toHaveLength(0);
  });
});

describe("redemption atomicity", () => {
  function orderInput(
    overrides: Partial<Omit<CreateOrderInput, "orderNumber">> & Pick<Omit<CreateOrderInput, "orderNumber">, "idempotencyKey" | "paymentId" | "cartId" | "items">,
  ): Omit<CreateOrderInput, "orderNumber"> {
    return {
      userId: null,
      guestToken: "rwd-svc-guest-token",
      guestEmail: "guest@test.com",
      subtotal: "1000.00",
      deliveryCharge: "0.00",
      discount: "0.00",
      couponCode: null,
      discountLabel: null,
      couponRedemption: null,
      pointsRedeemed: 40,
      pointsRedemptionValue: "40.00",
      pointsRedemption: null,
      grandTotal: "960.00",
      rewardPointsEarned: 10,
      deliveryZoneName: "Western",
      estimatedDaysMin: 1,
      estimatedDaysMax: 3,
      shipRecipientName: "Test Guest",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipLine2: null,
      shipCity: "Colombo",
      shipDistrict: null,
      shipPostalCode: null,
      ...overrides,
    };
  }

  it("a forced stock failure rolls back the points debit too — zero ledger rows survive", async () => {
    const user = await makeUser();
    const scarce = await makeProduct(1);
    const cart = await prisma.cart.create({ data: { userId: user.id } });
    const payment = await makePayment("960.00");

    await expect(
      createOrderWithStockDecrement({
        ...orderInput({
          userId: user.id,
          idempotencyKey: crypto.randomUUID(),
          paymentId: payment.id,
          cartId: cart.id,
          items: [
            {
              productId: scarce.id,
              productName: scarce.name,
              productSku: scarce.sku,
              unitPrice: "50.00",
              quantity: 2,
              lineTotal: "100.00",
              rewardPointsEarned: 2,
            },
          ],
          pointsRedemption: { userId: user.id, points: 40 },
        }),
        orderNumber: `ORS-RWD-SVC-ATOMIC-${++sequence}`,
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    const rows = await prisma.rewardTransaction.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(0);
  });
});
