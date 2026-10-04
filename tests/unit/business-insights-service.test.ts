// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { ChatCompletionMessage, ChatCompletionProvider } from "@/services/chat/chat-completion-provider.interface";
import { PermissionDeniedError } from "@/services/permission.errors";
import { getLatestInsights, recomputeInsights, setBusinessInsightsProvidersForTesting } from "@/services/business-insights.service";

const EMAIL_DOMAIN = "@business-insights-svc-test.test";
const ROLE_KEY_PREFIX = "business-insights-svc-test-role-";
const PRODUCT_SLUG_PREFIX = "business-insights-svc-test-product-";
const ORDER_PREFIX = "BIZ-INSIGHTS-SVC-TEST-ORDER-";
let sequence = 0;
let capturedMessages: ChatCompletionMessage[] | null = null;

function fakeChatProvider(response: object): ChatCompletionProvider {
  return {
    name: "fake",
    generateResponse: async (messages) => {
      capturedMessages = messages;
      return { content: JSON.stringify(response), promptTokens: 10, completionTokens: 5 };
    },
  };
}

function throwingChatProvider(): ChatCompletionProvider {
  return { name: "fake", generateResponse: async () => { throw new Error("simulated provider failure"); } };
}

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Biz Insights Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "CRMAnalytics", action: "View" },
    { module: "CRMAnalytics", action: "Edit" },
  ]);
}

async function makeProduct() {
  sequence += 1;
  return prisma.product.create({
    data: { name: `Test Product ${sequence}`, slug: `${PRODUCT_SLUG_PREFIX}${sequence}`, sku: `${PRODUCT_SLUG_PREFIX}${sequence}`, status: "Published" },
  });
}

async function makeOrderWithItem(productId: string, productName: string, quantity: number, unitPrice: string, createdAt: Date) {
  sequence += 1;
  const lineTotal = (Number(unitPrice) * quantity).toFixed(2);
  return prisma.order.create({
    data: {
      orderNumber: `${ORDER_PREFIX}${sequence}`,
      idempotencyKey: `idem-${ORDER_PREFIX}${sequence}`,
      status: "Confirmed",
      subtotal: lineTotal,
      deliveryCharge: "0.00",
      grandTotal: lineTotal,
      deliveryZoneName: "Western",
      shipRecipientName: "Test Customer",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipCity: "Colombo",
      createdAt,
      items: { create: [{ productId, productName, productSku: `${PRODUCT_SLUG_PREFIX}sku`, quantity, unitPrice, lineTotal }] },
    },
  });
}

function defaultResponse(overrides: object = {}) {
  return {
    trendNarrative: "Trends look steady.",
    anomalyNarrative: "No anomalies — note: only order volume is tracked, not traffic or conversion.",
    campaignSuggestions: [],
    ...overrides,
  };
}

afterEach(async () => {
  capturedMessages = null;
  setBusinessInsightsProvidersForTesting({ chat: throwingChatProvider() });
  await prisma.businessInsightSnapshot.deleteMany();
  await prisma.orderItem.deleteMany({ where: { order: { orderNumber: { startsWith: ORDER_PREFIX } } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: PRODUCT_SLUG_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("business-insights.service — permission gating", () => {
  it("rejects an admin without CRMAnalytics:Edit from recomputing", async () => {
    const viewer = await makeAdmin([{ module: "CRMAnalytics", action: "View" }]);
    await expect(recomputeInsights(viewer.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects an admin without CRMAnalytics:View from reading the summary", async () => {
    const stranger = await makeAdmin([]);
    await expect(getLatestInsights(stranger.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("business-insights.service — graceful fallback on provider failure", () => {
  it("writes no new snapshot rows and does not throw when the chat provider fails", async () => {
    const admin = await makeFullAccessAdmin();
    setBusinessInsightsProvidersForTesting({ chat: throwingChatProvider() });

    const result = await recomputeInsights(admin.id);

    expect(result.generated).toBe(false);
    const count = await prisma.businessInsightSnapshot.count();
    expect(count).toBe(0);
  });
});

describe("business-insights.service — anomaly narrative data-limitation disclosure", () => {
  it("stores a narrative, generated from real seeded data, grounded in the candidate set given to the provider", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    await makeOrderWithItem(product.id, product.name, 2, "50.00", new Date());
    setBusinessInsightsProvidersForTesting({ chat: fakeChatProvider(defaultResponse()) });

    const result = await recomputeInsights(admin.id);

    expect(result.generated).toBe(true);
    const contextMessage = capturedMessages?.find((m) => m.role === "user");
    expect(contextMessage?.content).toContain("Only order volume is tracked");

    const summary = await getLatestInsights(admin.id);
    expect(summary.anomaly?.narrativeText).toContain("only order volume");
  });
});

describe("business-insights.service — guardrail", () => {
  it("strips a campaign-suggestion product id the provider invented outside the real candidate set", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    await makeOrderWithItem(product.id, product.name, 3, "100.00", new Date());
    setBusinessInsightsProvidersForTesting({
      chat: fakeChatProvider(
        defaultResponse({
          campaignSuggestions: [{ title: "Push it", rationale: "Trending.", productIds: [product.id, "fabricated-product-id"], targetChurnTier: null }],
        }),
      ),
    });

    await recomputeInsights(admin.id);

    const summary = await getLatestInsights(admin.id);
    expect(summary.campaignSuggestions).toHaveLength(1);
    expect(summary.campaignSuggestions[0].structuredPayload?.suggestedProductIds).toEqual([product.id]);
  });

  it("persists multiple campaign suggestions from one batch as independently actionable rows", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    await makeOrderWithItem(product.id, product.name, 1, "20.00", new Date());
    setBusinessInsightsProvidersForTesting({
      chat: fakeChatProvider(
        defaultResponse({
          campaignSuggestions: [
            { title: "Idea A", rationale: "First.", productIds: [product.id], targetChurnTier: "High" },
            { title: "Idea B", rationale: "Second.", productIds: [product.id], targetChurnTier: null },
          ],
        }),
      ),
    });

    const result = await recomputeInsights(admin.id);

    expect(result.suggestionCount).toBe(2);
    const summary = await getLatestInsights(admin.id);
    expect(summary.campaignSuggestions.map((s) => s.structuredPayload?.title).sort()).toEqual(["Idea A", "Idea B"]);
  });
});

describe("business-insights.service — rate-limit independence (route-level, documented here for the service contract)", () => {
  it("recomputeInsights succeeds even when churn scoring hasn't been run — no coupling between the two actions", async () => {
    const admin = await makeFullAccessAdmin();
    setBusinessInsightsProvidersForTesting({ chat: fakeChatProvider(defaultResponse()) });

    const result = await recomputeInsights(admin.id);

    expect(result.generated).toBe(true);
  });
});
