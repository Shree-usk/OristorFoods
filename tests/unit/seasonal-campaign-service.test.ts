// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import { IllegalSeasonalCampaignStatusTransitionError, SeasonalCampaignNotFoundError } from "@/services/seasonal-campaign.errors";
import {
  changeSeasonalCampaignStatus,
  createSeasonalCampaign,
  getSeasonalCampaignAdminDetail,
  getSeasonalCampaignPerformanceSummary,
  listSeasonalCampaignsForAdmin,
  updateSeasonalCampaign,
} from "@/services/seasonal-campaign.service";
import { seasonalCampaignSchema } from "@/validation/seasonal-campaign.schema";

const EMAIL_DOMAIN = "@seasonal-campaign-svc-test.test";
const ROLE_KEY_PREFIX = "seasonal-campaign-svc-test-role-";
const NAME_PREFIX = "Seasonal Campaign Svc Test ";
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

function dateRange(startOffsetDays: number, endOffsetDays: number) {
  const now = Date.now();
  return { startDate: new Date(now + startOffsetDays * 86_400_000), endDate: new Date(now + endOffsetDays * 86_400_000) };
}

async function makeSeasonalCampaign(adminId: string, overrides: Partial<{ popupId: string | null; couponId: string | null; emailSmsCampaignId: string | null; homepageSectionId: string | null }> = {}) {
  sequence += 1;
  return prisma.seasonalCampaign.create({
    data: {
      name: `${NAME_PREFIX}${sequence}`,
      ...dateRange(0, 7),
      popupId: overrides.popupId ?? null,
      couponId: overrides.couponId ?? null,
      emailSmsCampaignId: overrides.emailSmsCampaignId ?? null,
      homepageSectionId: overrides.homepageSectionId ?? null,
      createdById: adminId,
    },
  });
}

async function makePopup() {
  sequence += 1;
  return prisma.promotionalPopup.create({
    data: { name: `${NAME_PREFIX}Popup ${sequence}`, title: "Test Popup", status: "Published", pageTarget: "AllPages", audienceTarget: "AllVisitors", triggerType: "Immediate", frequencyCap: "OncePerSession" },
  });
}

async function makeCoupon() {
  sequence += 1;
  return prisma.coupon.create({
    data: { code: `SEASONAL-TEST-${sequence}`, discountType: "PercentageOff", percentOff: 10, ...dateRange(-1, 30) },
  });
}

async function makeEmailSmsCampaign(adminId: string) {
  sequence += 1;
  return prisma.emailSmsCampaign.create({
    data: { name: `${NAME_PREFIX}Campaign ${sequence}`, channel: "Email", audienceTarget: "AllCustomers", body: "Hello", createdById: adminId },
  });
}

afterEach(async () => {
  await prisma.seasonalCampaign.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
  await prisma.promotionalPopup.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: "ORS-SEASONAL-TEST-" } } }); // cascades to CouponRedemption
  await prisma.coupon.deleteMany({ where: { code: { startsWith: "SEASONAL-TEST-" } } });
  await prisma.notificationLog.deleteMany({ where: { recipient: { endsWith: EMAIL_DOMAIN } } });
  await prisma.emailSmsCampaign.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("seasonalCampaignSchema — date range validation", () => {
  it("rejects an end date that is not after the start date", () => {
    const result = seasonalCampaignSchema.safeParse({ name: "X", startDate: "2026-06-10", endDate: "2026-06-01" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid date range", () => {
    const result = seasonalCampaignSchema.safeParse({ name: "X", startDate: "2026-06-01", endDate: "2026-06-10" });
    expect(result.success).toBe(true);
  });
});

describe("seasonal-campaign.service — admin CRUD and status transitions", () => {
  it("creates, updates, and lists a seasonal campaign, permission-gated and audited", async () => {
    const admin = await makeFullAccessAdmin();
    const { startDate, endDate } = dateRange(0, 7);
    const created = await createSeasonalCampaign(admin.id, { name: `${NAME_PREFIX}Avurudu Hub`, startDate, endDate, popupId: null, couponId: null, emailSmsCampaignId: null, homepageSectionId: null });
    expect(created.status).toBe("Draft");

    const updated = await updateSeasonalCampaign(admin.id, created.id, { name: `${NAME_PREFIX}Avurudu Mega Hub` });
    expect(updated.name).toBe(`${NAME_PREFIX}Avurudu Mega Hub`);

    const detail = await getSeasonalCampaignAdminDetail(admin.id, created.id);
    expect(detail.id).toBe(created.id);

    const list = await listSeasonalCampaignsForAdmin(admin.id);
    expect(list.some((campaign) => campaign.id === created.id)).toBe(true);

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "seasonal_campaign_created" } });
    expect(log).not.toBeNull();
  });

  it("rejects an unknown seasonal campaign", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(getSeasonalCampaignAdminDetail(admin.id, "missing-id")).rejects.toBeInstanceOf(SeasonalCampaignNotFoundError);
  });

  it("allows Edit-gated transitions (Draft -> Scheduled) without Approve, but rejects Approve-gated transitions (-> Active)", async () => {
    const editor = await makeEditOnlyAdmin();
    const campaign = await makeSeasonalCampaign(editor.id);

    const scheduled = await changeSeasonalCampaignStatus(editor.id, campaign.id, "Scheduled");
    expect(scheduled.status).toBe("Scheduled");

    await expect(changeSeasonalCampaignStatus(editor.id, campaign.id, "Active")).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("an Approve-gated admin can activate and end the campaign", async () => {
    const admin = await makeFullAccessAdmin();
    const campaign = await makeSeasonalCampaign(admin.id);
    await changeSeasonalCampaignStatus(admin.id, campaign.id, "Scheduled");

    const active = await changeSeasonalCampaignStatus(admin.id, campaign.id, "Active");
    expect(active.status).toBe("Active");

    const ended = await changeSeasonalCampaignStatus(admin.id, campaign.id, "Ended");
    expect(ended.status).toBe("Ended");

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "seasonal_campaign_status_changed", targetId: campaign.id } });
    expect(log).not.toBeNull();
  });

  it("rejects an illegal status transition (Draft -> Active, skipping Scheduled)", async () => {
    const admin = await makeFullAccessAdmin();
    const campaign = await makeSeasonalCampaign(admin.id);
    await expect(changeSeasonalCampaignStatus(admin.id, campaign.id, "Active")).rejects.toBeInstanceOf(IllegalSeasonalCampaignStatusTransitionError);
  });
});

describe("seasonal-campaign.service — performance summary", () => {
  it("returns null for every channel when nothing is linked", async () => {
    const admin = await makeFullAccessAdmin();
    const campaign = await makeSeasonalCampaign(admin.id);
    const summary = await getSeasonalCampaignPerformanceSummary(admin.id, campaign.id);
    expect(summary).toEqual({ popup: null, coupon: null, emailSmsCampaign: null });
  });

  it("aggregates real popup, coupon, and email/sms stats for linked items", async () => {
    const admin = await makeFullAccessAdmin();
    const popup = await makePopup();
    const coupon = await makeCoupon();
    const campaign = await makeEmailSmsCampaign(admin.id);

    await prisma.popupInteraction.createMany({ data: [{ popupId: popup.id, type: "Impression" }, { popupId: popup.id, type: "Impression" }, { popupId: popup.id, type: "Click" }] });
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORS-SEASONAL-TEST-${sequence}`,
        idempotencyKey: `seasonal-test-idem-${sequence}`,
        guestEmail: `redeemer-1${EMAIL_DOMAIN}`,
        status: "Confirmed",
        subtotal: "1000.00",
        deliveryCharge: "0.00",
        grandTotal: "900.00",
        deliveryZoneName: "Western",
        shipRecipientName: "x",
        shipPhone: "x",
        shipLine1: "x",
        shipCity: "x",
      },
    });
    await prisma.couponRedemption.create({ data: { couponId: coupon.id, guestEmail: `redeemer-1${EMAIL_DOMAIN}`, orderId: order.id, discountAmount: "100.00" } });
    await prisma.notificationLog.create({ data: { recipient: `recipient-1${EMAIL_DOMAIN}`, channel: "Email", templateKey: "seasonal-test", status: "Sent", triggeringEventId: campaign.id } });

    const hub = await makeSeasonalCampaign(admin.id, { popupId: popup.id, couponId: coupon.id, emailSmsCampaignId: campaign.id });
    const summary = await getSeasonalCampaignPerformanceSummary(admin.id, hub.id);

    expect(summary.popup).toEqual({ impressions: 2, clicks: 1, dismissals: 0 });
    expect(summary.coupon).toEqual({ redemptions: 1 });
    expect(summary.emailSmsCampaign).toEqual({ sent: 1, failed: 0, skippedNoConsent: 0 });
  });
});
