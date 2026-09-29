// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET as getBalance } from "@/app/api/rewards/balance/route";
import { GET as getTransactions } from "@/app/api/rewards/transactions/route";
import { POST as postPoints, DELETE as deletePoints } from "@/app/api/cart/points/route";
import { creditPointsForConfirmedOrder } from "@/services/rewards.service";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

const EMAIL_PREFIX = "rwd-route-";
let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `${EMAIL_PREFIX}${sequence}@test.com` } });
}

async function makeOrder(userId: string) {
  sequence += 1;
  return prisma.order.create({
    data: {
      orderNumber: `ORS-RWD-ROUTE-${sequence}`,
      idempotencyKey: `rwd-route-idem-${sequence}`,
      userId,
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

function sessionFor(userId: string): Session {
  return { user: { id: userId }, expires: new Date(Date.now() + 60_000).toISOString() } as Session;
}

function pointsRequest(method: "POST" | "DELETE", body?: unknown) {
  const headers = new Headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request("http://localhost/api/cart/points", { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
}

async function cleanupRewardsTables() {
  await prisma.customerBadge.deleteMany();
  await prisma.rewardTransaction.deleteMany();
  await prisma.rewardAccount.deleteMany();
  await prisma.rewardTier.deleteMany();
  await prisma.rewardSetting.deleteMany({ where: { id: "global" } });
}

beforeEach(async () => {
  mockAuth.mockReset();
  mockAuth.mockResolvedValue(null);
  await cleanupRewardsTables();
});

afterEach(async () => {
  await cleanupRewardsTables();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: "ORS-RWD-ROUTE-" } } });
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
});

describe("GET /api/rewards/balance", () => {
  it("401s for a guest", async () => {
    const response = await getBalance();
    expect(response.status).toBe(401);
  });

  it("returns the authenticated customer's balance", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 75);

    const response = await getBalance();
    const body = (await response.json()) as { spendable: number; lifetimeAchievement: number };
    expect(response.status).toBe(200);
    expect(body.spendable).toBe(75);
    expect(body.lifetimeAchievement).toBe(75);
  });
});

describe("GET /api/rewards/transactions", () => {
  it("401s for a guest", async () => {
    const response = await getTransactions(new Request("http://localhost/api/rewards/transactions"));
    expect(response.status).toBe(401);
  });

  it("returns the authenticated customer's transaction history, newest first", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    const first = await makeOrder(user.id);
    const second = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(first.id, user.id, 10);
    await creditPointsForConfirmedOrder(second.id, user.id, 20);

    const response = await getTransactions(new Request("http://localhost/api/rewards/transactions"));
    const body = (await response.json()) as { rows: Array<{ points: number }>; total: number };
    expect(response.status).toBe(200);
    expect(body.total).toBe(2);
    expect(body.rows[0].points).toBe(20);
    expect(body.rows[1].points).toBe(10);
  });
});

describe("POST /api/cart/points", () => {
  it("401s for a guest", async () => {
    const response = await postPoints(pointsRequest("POST", { points: 10 }));
    expect(response.status).toBe(401);
  });

  it("400s a non-positive points value", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    const response = await postPoints(pointsRequest("POST", { points: 0 }));
    expect(response.status).toBe(400);
  });

  it("409s with a structured shortfall when the request exceeds the balance", async () => {
    await prisma.rewardSetting.create({ data: { id: "global", pointsToCurrencyRate: "1.0000" } });
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 20);
    await prisma.cart.create({ data: { userId: user.id } });

    const response = await postPoints(pointsRequest("POST", { points: 100 }));
    const body = (await response.json()) as { code: string; requested: number; available: number };
    expect(response.status).toBe(409);
    expect(body.code).toBe("insufficient_balance");
    expect(body.requested).toBe(100);
    expect(body.available).toBe(20);
  });

  it("sets the cart's requested redemption for a valid amount", async () => {
    await prisma.rewardSetting.create({ data: { id: "global", pointsToCurrencyRate: "1.0000" } });
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 100);
    await prisma.cart.create({ data: { userId: user.id } });

    const response = await postPoints(pointsRequest("POST", { points: 50 }));
    expect(response.status).toBe(200);

    const cart = await prisma.cart.findUniqueOrThrow({ where: { userId: user.id } });
    expect(cart.pointsToRedeem).toBe(50);
  });
});

describe("DELETE /api/cart/points", () => {
  it("401s for a guest", async () => {
    const response = await deletePoints();
    expect(response.status).toBe(401);
  });

  it("clears a previously-requested redemption", async () => {
    await prisma.rewardSetting.create({ data: { id: "global", pointsToCurrencyRate: "1.0000" } });
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    const order = await makeOrder(user.id);
    await creditPointsForConfirmedOrder(order.id, user.id, 100);
    await prisma.cart.create({ data: { userId: user.id } });
    await postPoints(pointsRequest("POST", { points: 50 }));

    const response = await deletePoints();
    expect(response.status).toBe(200);
    const cart = await prisma.cart.findUniqueOrThrow({ where: { userId: user.id } });
    expect(cart.pointsToRedeem).toBe(0);
  });
});
