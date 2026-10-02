// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import * as popupInteractionRepository from "@/repositories/popup-interaction.repository";
import * as rewardsRepository from "@/repositories/rewards.repository";
import { PermissionDeniedError } from "@/services/permission.errors";
import { IllegalPopupStatusTransitionError, PopupNotFoundError } from "@/services/popup.errors";
import {
  changePopupStatus,
  createPopup,
  getPerformanceSummary,
  getPopupAdminDetail,
  listPopupsForAdmin,
  resolveEligiblePopup,
  updatePopup,
} from "@/services/popup.service";

const EMAIL_DOMAIN = "@popup-svc-test.test";
const ROLE_KEY_PREFIX = "popup-svc-test-role-";
const NAME_PREFIX = "Popup Svc Test ";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `${NAME_PREFIX}Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "Marketing", action: "View" },
    { module: "Marketing", action: "Edit" },
    { module: "Marketing", action: "Approve" },
  ]);
  return makeAdminUser(role.id);
}

async function makeEditOnlyAdmin() {
  const role = await makeRole([
    { module: "Marketing", action: "View" },
    { module: "Marketing", action: "Edit" },
  ]);
  return makeAdminUser(role.id);
}

async function makeCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}`, name: `Test Customer ${sequence}` } });
}

interface PopupOverrides {
  status?: "Draft" | "Scheduled" | "Published" | "Paused" | "Unpublished" | "Archived";
  pageTarget?: "AllPages" | "Homepage" | "Products" | "Recipes" | "Blog";
  audienceTarget?: "AllVisitors" | "NewVisitors" | "ReturningVisitors" | "Authenticated" | "CustomerGroupTarget" | "LoyaltyMembers" | "ReferralMembers";
  targetCustomerGroup?: "Retail" | "Wholesale" | null;
  frequencyCap?: "OncePerSession" | "OncePerDay" | "OncePerWeek" | "OncePerCustomer" | "UntilDismissed";
  startAt?: Date | null;
  endAt?: Date | null;
  variantGroupId?: string | null;
  variantWeight?: number;
}

async function makePopup(overrides: PopupOverrides = {}) {
  sequence += 1;
  return prisma.promotionalPopup.create({
    data: {
      name: `${NAME_PREFIX}${sequence}`,
      title: `Test Popup ${sequence}`,
      status: overrides.status ?? "Published",
      pageTarget: overrides.pageTarget ?? "AllPages",
      audienceTarget: overrides.audienceTarget ?? "AllVisitors",
      targetCustomerGroup: overrides.targetCustomerGroup ?? null,
      triggerType: "Immediate",
      frequencyCap: overrides.frequencyCap ?? "OncePerSession",
      startAt: overrides.startAt,
      endAt: overrides.endAt,
      variantGroupId: overrides.variantGroupId ?? null,
      variantWeight: overrides.variantWeight ?? 100,
    },
  });
}

afterEach(async () => {
  await prisma.popupInteraction.deleteMany({ where: { popup: { name: { startsWith: NAME_PREFIX } } } });
  await prisma.promotionalPopup.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
  await prisma.rewardTransaction.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.rewardAccount.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.referralAttribution.deleteMany({ where: { referrer: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("popup.service — admin CRUD and status transitions", () => {
  it("creates, updates, and lists a popup, permission-gated and audited", async () => {
    const admin = await makeFullAccessAdmin();
    const created = await createPopup(admin.id, {
      name: "Avurudu Sale",
      title: "Avurudu Sale",
      description: null,
      imageUrl: null,
      imageAlt: null,
      mobileImageUrl: null,
      mobileImageAlt: null,
      videoUrl: null,
      ctaLabel: "Shop now",
      ctaHref: "/products",
      secondaryCtaLabel: null,
      secondaryCtaHref: null,
      couponCode: "AVURUDU10",
      pageTarget: "AllPages",
      audienceTarget: "AllVisitors",
      targetCustomerGroup: null,
      triggerType: "Immediate",
      triggerValue: null,
      frequencyCap: "OncePerSession",
      startAt: null,
      endAt: null,
      variantGroupId: null,
      variantWeight: 100,
    });
    expect(created.status).toBe("Draft");

    const updated = await updatePopup(admin.id, created.id, { title: "Avurudu Mega Sale" });
    expect(updated.title).toBe("Avurudu Mega Sale");

    const detail = await getPopupAdminDetail(admin.id, created.id);
    expect(detail.id).toBe(created.id);

    const list = await listPopupsForAdmin(admin.id);
    expect(list.some((popup) => popup.id === created.id)).toBe(true);

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "popup_created" } });
    expect(log).not.toBeNull();
  });

  it("rejects an unknown popup", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(getPopupAdminDetail(admin.id, "missing-id")).rejects.toBeInstanceOf(PopupNotFoundError);
  });

  it("allows Edit-gated transitions (Draft -> Scheduled) without Approve, but rejects Approve-gated transitions (-> Published)", async () => {
    const editor = await makeEditOnlyAdmin();
    const popup = await makePopup({ status: "Draft" });

    const scheduled = await changePopupStatus(editor.id, popup.id, "Scheduled");
    expect(scheduled.status).toBe("Scheduled");

    await expect(changePopupStatus(editor.id, popup.id, "Published")).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("an Approve-gated admin can publish and unpublish", async () => {
    const admin = await makeFullAccessAdmin();
    const popup = await makePopup({ status: "Draft" });

    const published = await changePopupStatus(admin.id, popup.id, "Published");
    expect(published.status).toBe("Published");

    const unpublished = await changePopupStatus(admin.id, popup.id, "Unpublished");
    expect(unpublished.status).toBe("Unpublished");

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "popup_status_changed", targetId: popup.id } });
    expect(log).not.toBeNull();
  });

  it("rejects an illegal status transition (Archived -> Published)", async () => {
    const admin = await makeFullAccessAdmin();
    const popup = await makePopup({ status: "Archived" });
    await expect(changePopupStatus(admin.id, popup.id, "Published")).rejects.toBeInstanceOf(IllegalPopupStatusTransitionError);
  });

  it("returns a real performance summary", async () => {
    const admin = await makeFullAccessAdmin();
    const popup = await makePopup();
    await popupInteractionRepository.createInteraction(popup.id, null, "Impression");
    await popupInteractionRepository.createInteraction(popup.id, null, "Impression");
    await popupInteractionRepository.createInteraction(popup.id, null, "Click");

    const summary = await getPerformanceSummary(admin.id, popup.id);
    expect(summary).toEqual({ impressions: 2, clicks: 1, dismissals: 0 });
  });
});

describe("popup.service — resolveEligiblePopup", () => {
  it("matches by page target or AllPages, excludes a non-matching specific page target", async () => {
    const allPages = await makePopup({ pageTarget: "AllPages" });
    const productsOnly = await makePopup({ pageTarget: "Products" });
    const recipesOnly = await makePopup({ pageTarget: "Recipes" });

    const resolved = await resolveEligiblePopup({ pageTarget: "Products", userId: null, customerGroup: null });
    expect(resolved).not.toBeNull();
    expect([allPages.id, productsOnly.id]).toContain(resolved!.id);
    expect(resolved!.id).not.toBe(recipesOnly.id);
  });

  it("returns null when no popup is Published", async () => {
    await makePopup({ status: "Draft" });
    const resolved = await resolveEligiblePopup({ pageTarget: "AllPages", userId: null, customerGroup: null });
    expect(resolved).toBeNull();
  });

  it("respects the schedule window", async () => {
    const future = await makePopup({ startAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    const past = await makePopup({ endAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    const current = await makePopup({ startAt: new Date(Date.now() - 1000), endAt: new Date(Date.now() + 1000) });

    const resolved = await resolveEligiblePopup({ pageTarget: "AllPages", userId: null, customerGroup: null });
    expect(resolved!.id).toBe(current.id);
    expect(resolved!.id).not.toBe(future.id);
    expect(resolved!.id).not.toBe(past.id);
  });

  it("CustomerGroupTarget: matches the exact group, excludes a guest and a mismatched group", async () => {
    const popup = await makePopup({ audienceTarget: "CustomerGroupTarget", targetCustomerGroup: "Wholesale" });
    const customer = await makeCustomer();

    await expect(resolveEligiblePopup({ pageTarget: "AllPages", userId: customer.id, customerGroup: "Wholesale" })).resolves.toMatchObject({ id: popup.id });
    await expect(resolveEligiblePopup({ pageTarget: "AllPages", userId: customer.id, customerGroup: "Retail" })).resolves.toBeNull();
    await expect(resolveEligiblePopup({ pageTarget: "AllPages", userId: null, customerGroup: null })).resolves.toBeNull();
  });

  it("Authenticated: excludes a guest", async () => {
    await makePopup({ audienceTarget: "Authenticated" });
    await expect(resolveEligiblePopup({ pageTarget: "AllPages", userId: null, customerGroup: null })).resolves.toBeNull();
  });

  it("LoyaltyMembers: matches a customer with lifetime earned points, excludes one with none", async () => {
    const popup = await makePopup({ audienceTarget: "LoyaltyMembers" });
    const loyal = await makeCustomer();
    const fresh = await makeCustomer();
    await prisma.$transaction(async (tx) => {
      await rewardsRepository.getOrCreateAccount(tx, loyal.id);
      await rewardsRepository.createTransaction(tx, { userId: loyal.id, type: "Earned", points: 100, orderId: null });
    });

    await expect(resolveEligiblePopup({ pageTarget: "AllPages", userId: loyal.id, customerGroup: null })).resolves.toMatchObject({ id: popup.id });
    await expect(resolveEligiblePopup({ pageTarget: "AllPages", userId: fresh.id, customerGroup: null })).resolves.toBeNull();
  });

  it("ReferralMembers: matches a customer who has referred someone, excludes one who hasn't", async () => {
    const popup = await makePopup({ audienceTarget: "ReferralMembers" });
    const referrer = await makeCustomer();
    const referred = await makeCustomer();
    const outsider = await makeCustomer();
    await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: referred.id, status: "Registered" } });

    await expect(resolveEligiblePopup({ pageTarget: "AllPages", userId: referrer.id, customerGroup: null })).resolves.toMatchObject({ id: popup.id });
    await expect(resolveEligiblePopup({ pageTarget: "AllPages", userId: outsider.id, customerGroup: null })).resolves.toBeNull();
  });

  it("an authenticated customer's frequency cap (OncePerDay) blocks re-eligibility after a recent Impression", async () => {
    const popup = await makePopup({ frequencyCap: "OncePerDay" });
    const customer = await makeCustomer();

    await expect(resolveEligiblePopup({ pageTarget: "AllPages", userId: customer.id, customerGroup: null })).resolves.toMatchObject({ id: popup.id });

    await popupInteractionRepository.createInteraction(popup.id, customer.id, "Impression");
    await expect(resolveEligiblePopup({ pageTarget: "AllPages", userId: customer.id, customerGroup: null })).resolves.toBeNull();
  });

  it("UntilDismissed blocks re-eligibility after a Dismissal, regardless of how long ago", async () => {
    const popup = await makePopup({ frequencyCap: "UntilDismissed" });
    const customer = await makeCustomer();
    await popupInteractionRepository.createInteraction(popup.id, customer.id, "Dismissal");

    await expect(resolveEligiblePopup({ pageTarget: "AllPages", userId: customer.id, customerGroup: null })).resolves.toBeNull();
  });

  it("variant group: the weighted pick only ever returns one of the two siblings", async () => {
    const groupId = `variant-group-${Date.now()}`;
    const a = await makePopup({ variantGroupId: groupId, variantWeight: 50 });
    const b = await makePopup({ variantGroupId: groupId, variantWeight: 50 });

    const seenIds = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const resolved = await resolveEligiblePopup({ pageTarget: "AllPages", userId: null, customerGroup: null });
      expect(resolved).not.toBeNull();
      expect([a.id, b.id]).toContain(resolved!.id);
      seenIds.add(resolved!.id);
    }
    expect(seenIds.size).toBeGreaterThan(0);
  });
});
