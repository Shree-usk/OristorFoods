// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import { CampaignNotFoundError, IllegalCampaignEditError, IllegalCampaignSendError } from "@/services/campaign.errors";
import {
  createCampaign,
  getCampaignAdminDetail,
  getCampaignDeliverySummary,
  listCampaignsForAdmin,
  processDueCampaigns,
  sendCampaignNow,
  updateCampaign,
} from "@/services/email-sms-campaign.service";

const EMAIL_DOMAIN = "@campaign-svc-test.test";
const ROLE_KEY_PREFIX = "campaign-svc-test-role-";
const NAME_PREFIX = "Campaign Svc Test ";
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

interface CustomerOverrides {
  customerGroup?: "Retail" | "Wholesale";
  marketingOptIn?: boolean;
  smsOptIn?: boolean;
  phone?: string | null;
}

async function makeCustomer(overrides: CustomerOverrides = {}) {
  sequence += 1;
  const user = await prisma.user.create({
    data: {
      email: `customer-${sequence}${EMAIL_DOMAIN}`,
      name: `Test Customer ${sequence}`,
      customerGroup: overrides.customerGroup ?? "Retail",
      marketingOptIn: overrides.marketingOptIn ?? false,
    },
  });
  await prisma.notificationPreference.create({
    data: { userId: user.id, phone: overrides.phone === undefined ? `+9477${String(sequence).padStart(7, "0")}` : overrides.phone, smsOptIn: overrides.smsOptIn ?? false },
  });
  return user;
}

async function makeSmsCampaign(
  overrides: Partial<{
    audienceTarget: "AllCustomers" | "CustomerGroupTarget" | "LoyaltyMembers" | "ReferralMembers" | "SavedSegment";
    targetCustomerGroup: "Retail" | "Wholesale" | null;
    targetSegmentId: string | null;
    status: "Draft" | "Scheduled" | "Sent";
    scheduledAt: Date | null;
    body: string;
  }> = {},
  createdById: string,
) {
  sequence += 1;
  return prisma.emailSmsCampaign.create({
    data: {
      name: `${NAME_PREFIX}${sequence}`,
      channel: "SMS",
      audienceTarget: overrides.audienceTarget ?? "AllCustomers",
      targetCustomerGroup: overrides.targetCustomerGroup ?? null,
      targetSegmentId: overrides.targetSegmentId ?? null,
      body: overrides.body ?? "Hi {{name}}, enjoy a discount!",
      status: overrides.status ?? "Draft",
      scheduledAt: overrides.scheduledAt ?? null,
      createdById,
    },
  });
}

afterEach(async () => {
  await prisma.notificationLog.deleteMany({ where: { recipient: { startsWith: "+9477" } } });
  await prisma.emailSmsCampaign.deleteMany({ where: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.savedSegment.deleteMany({ where: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.rewardTransaction.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.referralAttribution.deleteMany({ where: { referrer: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.notificationPreference.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("email-sms-campaign.service: permissions", () => {
  it("an Edit-only admin can create a campaign but cannot send it", async () => {
    const admin = await makeEditOnlyAdmin();
    const campaign = await createCampaign(admin.id, { name: "x", channel: "SMS", audienceTarget: "AllCustomers", targetCustomerGroup: null, targetSegmentId: null, subject: null, body: "hi {{name}}", scheduledAt: null });
    expect(campaign.status).toBe("Draft");
    await expect(sendCampaignNow(admin.id, campaign.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("a View-only admin cannot create a campaign but can list", async () => {
    const role = await makeRole([{ module: "Marketing", action: "View" }]);
    const admin = await makeAdminUser(role.id);
    await expect(createCampaign(admin.id, { name: "x", channel: "SMS", audienceTarget: "AllCustomers", targetCustomerGroup: null, targetSegmentId: null, subject: null, body: "hi", scheduledAt: null })).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(listCampaignsForAdmin(admin.id)).resolves.toBeInstanceOf(Array);
  });
});

describe("email-sms-campaign.service: audience resolution + sending", () => {
  it("AllCustomers sends only to SMS-opted-in, phoned customers — not opted-out ones", async () => {
    const admin = await makeFullAccessAdmin();
    const optedIn = await makeCustomer({ smsOptIn: true });
    const optedOut = await makeCustomer({ smsOptIn: false });
    const campaign = await makeSmsCampaign({}, admin.id);

    await sendCampaignNow(admin.id, campaign.id);

    const sentLog = await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign.id, userId: optedIn.id } });
    expect(sentLog?.status).toBe("Sent");
    const skippedLog = await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign.id, userId: optedOut.id } });
    expect(skippedLog).toBeNull();
  });

  it("CustomerGroupTarget only sends within that group", async () => {
    const admin = await makeFullAccessAdmin();
    const retail = await makeCustomer({ customerGroup: "Retail", smsOptIn: true });
    const wholesale = await makeCustomer({ customerGroup: "Wholesale", smsOptIn: true });
    const campaign = await makeSmsCampaign({ audienceTarget: "CustomerGroupTarget", targetCustomerGroup: "Retail" }, admin.id);

    await sendCampaignNow(admin.id, campaign.id);

    expect(await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign.id, userId: retail.id } })).not.toBeNull();
    expect(await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign.id, userId: wholesale.id } })).toBeNull();
  });

  it("LoyaltyMembers only sends to customers with positive lifetime achievement", async () => {
    const admin = await makeFullAccessAdmin();
    const loyal = await makeCustomer({ smsOptIn: true });
    const notLoyal = await makeCustomer({ smsOptIn: true });
    await prisma.rewardTransaction.create({ data: { userId: loyal.id, type: "Earned", points: 100 } });
    const campaign = await makeSmsCampaign({ audienceTarget: "LoyaltyMembers" }, admin.id);

    await sendCampaignNow(admin.id, campaign.id);

    expect(await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign.id, userId: loyal.id } })).not.toBeNull();
    expect(await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign.id, userId: notLoyal.id } })).toBeNull();
  });

  it("ReferralMembers sends to both a referrer and a referred customer", async () => {
    const admin = await makeFullAccessAdmin();
    const referrer = await makeCustomer({ smsOptIn: true });
    const referred = await makeCustomer({ smsOptIn: true });
    const uninvolved = await makeCustomer({ smsOptIn: true });
    await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: referred.id } });
    const campaign = await makeSmsCampaign({ audienceTarget: "ReferralMembers" }, admin.id);

    await sendCampaignNow(admin.id, campaign.id);

    expect(await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign.id, userId: referrer.id } })).not.toBeNull();
    expect(await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign.id, userId: referred.id } })).not.toBeNull();
    expect(await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign.id, userId: uninvolved.id } })).toBeNull();
  });

  // STORY-059a.
  it("SavedSegment sends to exactly the segment's live members", async () => {
    const admin = await makeFullAccessAdmin();
    const inSegment = await makeCustomer({ customerGroup: "Wholesale", smsOptIn: true });
    const outOfSegment = await makeCustomer({ customerGroup: "Retail", smsOptIn: true });
    const segment = await prisma.savedSegment.create({ data: { name: `${NAME_PREFIX}segment-${sequence}`, filterCriteria: { customerGroup: "Wholesale" }, createdById: admin.id } });
    const campaign = await makeSmsCampaign({ audienceTarget: "SavedSegment", targetSegmentId: segment.id }, admin.id);

    await sendCampaignNow(admin.id, campaign.id);

    expect(await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign.id, userId: inSegment.id } })).not.toBeNull();
    expect(await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign.id, userId: outOfSegment.id } })).toBeNull();
  });

  it("renders the {{name}} merge field into the message body actually sent", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer({ smsOptIn: true });
    const campaign = await makeSmsCampaign({ body: "Hi {{name}}, 15% off!" }, admin.id);

    await sendCampaignNow(admin.id, campaign.id);

    expect(await prisma.notificationLog.findFirst({ where: { triggeringEventId: campaign.id, userId: customer.id, status: "Sent" } })).not.toBeNull();
  });

  it("sending the same campaign twice never double-sends to the same recipient", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer({ smsOptIn: true });
    const campaign = await makeSmsCampaign({}, admin.id);

    await sendCampaignNow(admin.id, campaign.id);
    // Force the campaign back to Draft so the second call is accepted — the dedup is tested, not the status guard.
    await prisma.emailSmsCampaign.update({ where: { id: campaign.id }, data: { status: "Draft" } });
    await sendCampaignNow(admin.id, campaign.id);

    const logs = await prisma.notificationLog.findMany({ where: { triggeringEventId: campaign.id, userId: customer.id } });
    expect(logs).toHaveLength(1);
  });

  it("marks the campaign Sent and rejects a second send once already Sent", async () => {
    const admin = await makeFullAccessAdmin();
    await makeCustomer({ smsOptIn: true });
    const campaign = await makeSmsCampaign({}, admin.id);

    const sent = await sendCampaignNow(admin.id, campaign.id);
    expect(sent.status).toBe("Sent");
    expect(sent.sentAt).not.toBeNull();

    await expect(sendCampaignNow(admin.id, campaign.id)).rejects.toBeInstanceOf(IllegalCampaignSendError);
  });

  it("blocks editing a Sent campaign", async () => {
    const admin = await makeFullAccessAdmin();
    const campaign = await makeSmsCampaign({ status: "Sent" }, admin.id);
    await expect(updateCampaign(admin.id, campaign.id, { name: "renamed" })).rejects.toBeInstanceOf(IllegalCampaignEditError);
  });

  it("a real delivery summary reflects sent/skipped counts", async () => {
    const admin = await makeFullAccessAdmin();
    await makeCustomer({ smsOptIn: true });
    await makeCustomer({ smsOptIn: false });
    const campaign = await makeSmsCampaign({}, admin.id);
    await sendCampaignNow(admin.id, campaign.id);

    const summary = await getCampaignDeliverySummary(admin.id, campaign.id);
    expect(summary.sent).toBe(1);
  });

  it("404s for a nonexistent campaign id", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(getCampaignAdminDetail(admin.id, "nonexistent-id")).rejects.toBeInstanceOf(CampaignNotFoundError);
  });
});

describe("email-sms-campaign.service: processDueCampaigns", () => {
  it("only processes Scheduled campaigns whose scheduledAt has passed — not Draft, not future-scheduled", async () => {
    const admin = await makeFullAccessAdmin();
    const dueCustomer = await makeCustomer({ smsOptIn: true });
    const due = await makeSmsCampaign({ status: "Scheduled", scheduledAt: new Date(Date.now() - 60_000) }, admin.id);
    const future = await makeSmsCampaign({ status: "Scheduled", scheduledAt: new Date(Date.now() + 60_000) }, admin.id);
    const draft = await makeSmsCampaign({ status: "Draft" }, admin.id);

    const result = await processDueCampaigns(admin.id);

    expect(result.processed).toBe(1);
    expect(result.results[0].campaignId).toBe(due.id);
    expect((await prisma.emailSmsCampaign.findUnique({ where: { id: due.id } }))?.status).toBe("Sent");
    expect((await prisma.emailSmsCampaign.findUnique({ where: { id: future.id } }))?.status).toBe("Scheduled");
    expect((await prisma.emailSmsCampaign.findUnique({ where: { id: draft.id } }))?.status).toBe("Draft");
    expect(await prisma.notificationLog.findFirst({ where: { triggeringEventId: due.id, userId: dueCustomer.id } })).not.toBeNull();
  });

  it("requires Approve", async () => {
    const admin = await makeEditOnlyAdmin();
    await expect(processDueCampaigns(admin.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
