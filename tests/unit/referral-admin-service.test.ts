// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import { updateReferralSetting } from "@/services/referral.service";

const EMAIL_DOMAIN = "@referral-admin-svc-test.test";
const ROLE_KEY_PREFIX = "referral-admin-svc-test-role-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Referral Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

afterEach(async () => {
  await prisma.referralSetting.deleteMany({ where: { id: "global" } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("referral.service — updateReferralSetting", () => {
  it("updates the singleton setting including the new fraud-threshold fields, and audits it", async () => {
    const role = await makeRole([
      { module: "RewardsReferrals", action: "View" },
      { module: "RewardsReferrals", action: "Edit" },
    ]);
    const admin = await makeAdminUser(role.id);

    const updated = await updateReferralSetting(admin.id, { referrerBonusPoints: 150, maxReferralsPerPeriod: 5, referralPeriodDays: 7 });
    expect(updated.referrerBonusPoints).toBe(150);
    expect(updated.maxReferralsPerPeriod).toBe(5);
    expect(updated.referralPeriodDays).toBe(7);

    const row = await prisma.referralSetting.findUniqueOrThrow({ where: { id: "global" } });
    expect(row.maxReferralsPerPeriod).toBe(5);

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "referral_setting_updated" } });
    expect(log).not.toBeNull();
  });

  it("denies a View-only admin", async () => {
    const role = await makeRole([{ module: "RewardsReferrals", action: "View" }]);
    const viewer = await makeAdminUser(role.id);
    await expect(updateReferralSetting(viewer.id, { referrerBonusPoints: 100 })).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
