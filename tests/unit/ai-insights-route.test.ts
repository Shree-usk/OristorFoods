// tests/unit/ai-insights-route.test.ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { resetRateLimit } from "@/lib/rate-limit";
import { setBusinessInsightsProvidersForTesting } from "@/services/business-insights.service";
import type { ChatCompletionProvider } from "@/services/chat/chat-completion-provider.interface";

// Mirrors support-assistant-route.test.ts's own reasoning for mocking the
// auth module directly rather than exercising real NextAuth machinery.
vi.mock("@/lib/admin-auth", () => ({ adminAuth: vi.fn() }));

const { adminAuth } = await import("@/lib/admin-auth");
const { POST: recomputeChurn } = await import("@/app/api/admin/ai-insights/recompute-churn/route");
const { POST: recomputeInsightsRoute } = await import("@/app/api/admin/ai-insights/recompute-insights/route");
const { GET: churnRisk } = await import("@/app/api/admin/ai-insights/churn-risk/route");
const mockAdminAuth = adminAuth as unknown as Mock<() => Promise<Session | null>>;

const EMAIL_DOMAIN = "@ai-insights-route-test.test";
const ROLE_KEY_PREFIX = "ai-insights-route-test-role-";
let sequence = 0;

function throwingChatProvider(): ChatCompletionProvider {
  return { name: "fake", generateResponse: async () => { throw new Error("simulated provider failure"); } };
}

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `AI Insights Route Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function sessionFor(adminId: string) {
  return { user: { id: adminId }, expires: new Date(Date.now() + 60_000).toISOString() };
}

let fullAccessAdminId: string;
let noAccessAdminId: string;

beforeEach(async () => {
  const fullAccess = await makeAdmin([
    { module: "CRMAnalytics", action: "View" },
    { module: "CRMAnalytics", action: "Edit" },
  ]);
  const noAccess = await makeAdmin([]);
  fullAccessAdminId = fullAccess.id;
  noAccessAdminId = noAccess.id;
  setBusinessInsightsProvidersForTesting({ chat: throwingChatProvider() });
});

afterEach(async () => {
  resetRateLimit(`churn-recompute:${fullAccessAdminId}`);
  resetRateLimit(`insight-narrative-recompute:${fullAccessAdminId}`);
  await prisma.customerChurnScore.deleteMany({ where: { customer: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  vi.clearAllMocks();
});

describe("POST /api/admin/ai-insights/recompute-churn", () => {
  it("returns a 200 happy-path result for an admin with CRMAnalytics:Edit", async () => {
    mockAdminAuth.mockResolvedValue(sessionFor(fullAccessAdminId));
    const response = await recomputeChurn();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("customersScored");
  });

  it("returns 403 for an admin without CRMAnalytics:Edit", async () => {
    mockAdminAuth.mockResolvedValue(sessionFor(noAccessAdminId));
    const response = await recomputeChurn();
    expect(response.status).toBe(403);
  });

  it("returns 401 with no session", async () => {
    mockAdminAuth.mockResolvedValue(null);
    const response = await recomputeChurn();
    expect(response.status).toBe(401);
  });

  it("rejects a second call within the cooldown window with 429", async () => {
    mockAdminAuth.mockResolvedValue(sessionFor(fullAccessAdminId));
    const first = await recomputeChurn();
    const second = await recomputeChurn();
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });
});

describe("POST /api/admin/ai-insights/recompute-insights — independent rate limit from recompute-churn", () => {
  it("is not blocked by a recompute-churn call hitting its own limit", async () => {
    mockAdminAuth.mockResolvedValue(sessionFor(fullAccessAdminId));
    await recomputeChurn();
    const churnSecond = await recomputeChurn();
    expect(churnSecond.status).toBe(429);

    const insightsResponse = await recomputeInsightsRoute();
    expect(insightsResponse.status).toBe(200);
  });
});

describe("GET /api/admin/ai-insights/churn-risk", () => {
  it("returns 403 for an admin without CRMAnalytics:View", async () => {
    mockAdminAuth.mockResolvedValue(sessionFor(noAccessAdminId));
    const response = await churnRisk(new Request("http://localhost/api/admin/ai-insights/churn-risk"));
    expect(response.status).toBe(403);
  });

  it("returns 400 for an invalid riskTier filter", async () => {
    mockAdminAuth.mockResolvedValue(sessionFor(fullAccessAdminId));
    const response = await churnRisk(new Request("http://localhost/api/admin/ai-insights/churn-risk?riskTier=Invalid"));
    expect(response.status).toBe(400);
  });
});
