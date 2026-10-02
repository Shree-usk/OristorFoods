// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { createAddress } from "@/repositories/address.repository";
import * as rewardsRepository from "@/repositories/rewards.repository";
import { FraudFlagNotFoundError, FraudFlagNotPendingError } from "@/services/fraud-detection.errors";
import { approveFlag, checkRedemptionVelocity, checkReferralVelocity, checkSharedAddress, listFraudFlags, reverseFlag } from "@/services/fraud-detection.service";
import { PermissionDeniedError } from "@/services/permission.errors";
import { getBalanceForUser } from "@/services/rewards.service";

const EMAIL_DOMAIN = "@fraud-detect-svc-test.test";
const ROLE_KEY_PREFIX = "fraud-detect-svc-test-role-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Fraud Detect Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "RewardsReferrals", action: "View" },
    { module: "RewardsReferrals", action: "Approve" },
  ]);
  return makeAdminUser(role.id);
}

async function makeCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}`, name: `Test Customer ${sequence}` } });
}

async function makeAddress(userId: string, line1: string, city: string) {
  return createAddress(
    userId,
    { label: "Home", type: "Both", recipientName: "Test", phone: "0771234567", line1, line2: null, city, district: null, postalCode: null, country: "LK", companyName: null, taxId: null },
    { isDefaultBilling: true, isDefaultShipping: true },
  );
}

afterEach(async () => {
  await prisma.fraudFlag.deleteMany({ where: { customer: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.rewardTransaction.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.rewardAccount.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.address.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.referralAttribution.deleteMany({ where: { referrer: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.referralSetting.deleteMany({ where: { id: "global" } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("fraud-detection.service — checkSharedAddress", () => {
  it("flags a referrer whose saved address matches the referred order's shipping address", async () => {
    const referrer = await makeCustomer();
    await makeAddress(referrer.id, "10 Galle Road", "Colombo");
    const referred = await makeCustomer();
    const attribution = await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: referred.id, status: "Qualified" } });

    await checkSharedAddress(referrer.id, { shipLine1: "10 galle road", shipCity: "colombo" }, attribution.id, null);

    const flags = await prisma.fraudFlag.findMany({ where: { customerId: referrer.id } });
    expect(flags).toHaveLength(1);
    expect(flags[0].type).toBe("referral_shared_address");
  });

  it("does not flag when no saved address matches", async () => {
    const referrer = await makeCustomer();
    await makeAddress(referrer.id, "5 Kandy Road", "Kandy");
    const attribution = await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: (await makeCustomer()).id, status: "Qualified" } });

    await checkSharedAddress(referrer.id, { shipLine1: "99 Different Street", shipCity: "Galle" }, attribution.id, null);

    const flags = await prisma.fraudFlag.findMany({ where: { customerId: referrer.id } });
    expect(flags).toHaveLength(0);
  });
});

describe("fraud-detection.service — checkReferralVelocity", () => {
  it("flags a referrer exceeding the configured max-referrals-per-period", async () => {
    const referrer = await makeCustomer();
    await prisma.referralSetting.create({ data: { id: "global", maxReferralsPerPeriod: 2, referralPeriodDays: 7 } });
    for (let i = 0; i < 3; i += 1) {
      await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: (await makeCustomer()).id, status: "Registered" } });
    }
    const triggeringAttribution = await prisma.referralAttribution.findFirstOrThrow({ where: { referrerUserId: referrer.id } });

    await checkReferralVelocity(referrer.id, triggeringAttribution.id);

    const flags = await prisma.fraudFlag.findMany({ where: { customerId: referrer.id } });
    expect(flags).toHaveLength(1);
    expect(flags[0].type).toBe("referral_velocity");
  });

  it("does not flag, and the check is a no-op, when the threshold isn't configured", async () => {
    const referrer = await makeCustomer();
    const attribution = await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: (await makeCustomer()).id, status: "Registered" } });

    await checkReferralVelocity(referrer.id, attribution.id);

    const flags = await prisma.fraudFlag.findMany({ where: { customerId: referrer.id } });
    expect(flags).toHaveLength(0);
  });
});

describe("fraud-detection.service — checkRedemptionVelocity", () => {
  it("flags a customer whose recent redemptions exceed the fixed threshold", async () => {
    const customer = await makeCustomer();
    await rewardsRepository.getOrCreateAccount(prisma, customer.id);
    await prisma.rewardTransaction.create({ data: { userId: customer.id, type: "Redeemed", points: -2500, orderId: null } });

    await checkRedemptionVelocity(customer.id);

    const flags = await prisma.fraudFlag.findMany({ where: { customerId: customer.id } });
    expect(flags).toHaveLength(1);
    expect(flags[0].type).toBe("redemption_velocity");
  });

  it("does not flag a customer below the threshold", async () => {
    const customer = await makeCustomer();
    await rewardsRepository.getOrCreateAccount(prisma, customer.id);
    await prisma.rewardTransaction.create({ data: { userId: customer.id, type: "Redeemed", points: -500, orderId: null } });

    await checkRedemptionVelocity(customer.id);

    const flags = await prisma.fraudFlag.findMany({ where: { customerId: customer.id } });
    expect(flags).toHaveLength(0);
  });
});

describe("fraud-detection.service — approve/reverse", () => {
  it("approve dismisses the flag with no reward change", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();
    const flag = await prisma.fraudFlag.create({ data: { customerId: customer.id, type: "test_flag" } });

    const resolved = await approveFlag(admin.id, flag.id);
    expect(resolved.status).toBe("Approved");

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "fraud_flag_approved" } });
    expect(log).not.toBeNull();
  });

  it("reverse claws back the related Earned transaction's points", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();
    await rewardsRepository.getOrCreateAccount(prisma, customer.id);
    const earned = await prisma.rewardTransaction.create({ data: { userId: customer.id, type: "Earned", points: 300, orderId: null } });
    const flag = await prisma.fraudFlag.create({ data: { customerId: customer.id, type: "test_flag", relatedRewardTransactionId: earned.id } });

    await reverseFlag(admin.id, flag.id, "Confirmed fraudulent earn.");

    const balance = await getBalanceForUser(customer.id);
    expect(balance.spendable).toBe(0);

    const resolved = await prisma.fraudFlag.findUniqueOrThrow({ where: { id: flag.id } });
    expect(resolved.status).toBe("Reversed");
  });

  it("rejects resolving an already-resolved flag, and an unknown flag", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();
    const flag = await prisma.fraudFlag.create({ data: { customerId: customer.id, type: "test_flag", status: "Approved" } });

    await expect(approveFlag(admin.id, flag.id)).rejects.toBeInstanceOf(FraudFlagNotPendingError);
    await expect(approveFlag(admin.id, "missing-id")).rejects.toBeInstanceOf(FraudFlagNotFoundError);
  });

  it("denies a View-only admin from approving or reversing", async () => {
    const role = await makeRole([{ module: "RewardsReferrals", action: "View" }]);
    const viewer = await makeAdminUser(role.id);
    const customer = await makeCustomer();
    const flag = await prisma.fraudFlag.create({ data: { customerId: customer.id, type: "test_flag" } });

    await expect(approveFlag(viewer.id, flag.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("lists flags filtered by status", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();
    await prisma.fraudFlag.create({ data: { customerId: customer.id, type: "test_flag", status: "Pending" } });
    await prisma.fraudFlag.create({ data: { customerId: customer.id, type: "test_flag", status: "Approved" } });

    const pending = await listFraudFlags(admin.id, "Pending", 1, 20);
    expect(pending.flags.every((flag) => flag.status === "Pending")).toBe(true);
  });
});
