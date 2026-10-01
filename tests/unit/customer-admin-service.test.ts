// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import { AccountAlreadySuspendedError, AccountNotSuspendedError, CustomerNotFoundError } from "@/services/customer-admin.errors";
import {
  addNote,
  getCustomerAdminDetail,
  grantReward,
  issueCoupon,
  listCustomersForAdmin,
  reactivateCustomer,
  setCustomerGroup,
  suspendCustomer,
} from "@/services/customer-admin.service";
import { AccountSuspendedError } from "@/services/auth.errors";
import { verifyCredentials } from "@/services/auth.service";
import { validateCoupon } from "@/services/coupon.service";
import { CouponNotFoundError } from "@/services/coupon.errors";

const EMAIL_DOMAIN = "@customer-admin-svc-test.test";
const ROLE_KEY_PREFIX = "customer-admin-svc-test-role-";
const TEST_PASSWORD = "correct-horse-battery-staple";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Customer Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "Customers", action: "View" },
    { module: "Customers", action: "Edit" },
    { module: "Customers", action: "Approve" },
  ]);
  return makeAdminUser(role.id);
}

async function makeCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}`, name: `Test Customer ${sequence}` } });
}

async function makeCustomerWithPassword() {
  sequence += 1;
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  return prisma.user.create({ data: { email: `customer-pw-${sequence}${EMAIL_DOMAIN}`, name: `Test Customer ${sequence}`, passwordHash } });
}

afterEach(async () => {
  await prisma.loginEvent.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminNote.deleteMany({ where: { customer: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.coupon.deleteMany({ where: { restrictedToUser: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.rewardTransaction.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.rewardAccount.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("customer-admin.service — setCustomerGroup", () => {
  it("sets the customer's group and writes an audit log", async () => {
    const role = await makeRole([{ module: "Customers", action: "Edit" }]);
    const admin = await makeAdminUser(role.id);
    const customer = await makeCustomer();

    const updated = await setCustomerGroup(admin.id, customer.id, "Distributor");
    expect(updated.customerGroup).toBe("Distributor");

    const row = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(row.customerGroup).toBe("Distributor");

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "customer_group_set" } });
    expect(log).not.toBeNull();
  });

  it("denies an admin without Customers/Edit", async () => {
    const role = await makeRole([{ module: "Customers", action: "View" }]);
    const viewer = await makeAdminUser(role.id);
    const customer = await makeCustomer();

    await expect(setCustomerGroup(viewer.id, customer.id, "Distributor")).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects an unknown customer", async () => {
    const role = await makeRole([{ module: "Customers", action: "Edit" }]);
    const admin = await makeAdminUser(role.id);

    await expect(setCustomerGroup(admin.id, "missing-id", "Distributor")).rejects.toBeInstanceOf(CustomerNotFoundError);
  });
});

describe("customer-admin.service — list/detail", () => {
  it("lists customers, never leaking passwordHash, and composes a full detail read", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();

    const list = await listCustomersForAdmin(admin.id, {}, 1, 20);
    const row = list.customers.find((item) => item.id === customer.id);
    expect(row).toBeDefined();
    expect(row).not.toHaveProperty("passwordHash");

    const detail = await getCustomerAdminDetail(admin.id, customer.id);
    expect(detail.customer.id).toBe(customer.id);
    expect(detail.customer).not.toHaveProperty("passwordHash");
    expect(detail.orders.orders).toEqual([]);
    expect(detail.notes).toEqual([]);
  });
});

describe("customer-admin.service — suspend/reactivate", () => {
  it("suspends a customer and blocks their storefront login; reactivating restores it", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomerWithPassword();

    await expect(verifyCredentials(customer.email!, TEST_PASSWORD)).resolves.toMatchObject({ id: customer.id });

    const suspended = await suspendCustomer(admin.id, customer.id, "Repeated chargeback fraud.");
    expect(suspended.status).toBe("Suspended");

    await expect(verifyCredentials(customer.email!, TEST_PASSWORD)).rejects.toBeInstanceOf(AccountSuspendedError);

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "customer_suspended" } });
    expect(log).not.toBeNull();

    const reactivated = await reactivateCustomer(admin.id, customer.id);
    expect(reactivated.status).toBe("Active");
    await expect(verifyCredentials(customer.email!, TEST_PASSWORD)).resolves.toMatchObject({ id: customer.id });
  });

  it("rejects double-suspend and reactivating a non-suspended account", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();

    await suspendCustomer(admin.id, customer.id, "Fraud.");
    await expect(suspendCustomer(admin.id, customer.id, "Fraud again.")).rejects.toBeInstanceOf(AccountAlreadySuspendedError);

    const active = await makeCustomer();
    await expect(reactivateCustomer(admin.id, active.id)).rejects.toBeInstanceOf(AccountNotSuspendedError);
  });

  it("denies suspend/reactivate to a View-only admin", async () => {
    const role = await makeRole([{ module: "Customers", action: "View" }]);
    const viewer = await makeAdminUser(role.id);
    const customer = await makeCustomer();

    await expect(suspendCustomer(viewer.id, customer.id, "x")).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("customer-admin.service — login event writing", () => {
  it("writes a LoginEvent on success and on a wrong password for a real user, but nothing for a nonexistent email", async () => {
    const customer = await makeCustomerWithPassword();

    await verifyCredentials(customer.email!, TEST_PASSWORD);
    await verifyCredentials(customer.email!, "wrong-password");
    await verifyCredentials(`nobody-${Date.now()}@customer-admin-svc-test.test`, "whatever");

    const events = await prisma.loginEvent.findMany({ where: { userId: customer.id } });
    expect(events).toHaveLength(2);
    expect(events.filter((event) => event.success)).toHaveLength(1);
    expect(events.filter((event) => !event.success)).toHaveLength(1);
  });
});

describe("customer-admin.service — grant reward / issue coupon / notes", () => {
  it("grants reward points reflected in the customer's wallet, Approve-gated", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();

    await grantReward(admin.id, customer.id, 150, "Service recovery.", null);
    const { getRewardsSummary } = await import("@/services/customer-rewards-dashboard.service");
    const balance = await getRewardsSummary(customer.id);
    expect(balance.spendable).toBe(150);

    const editorRole = await makeRole([
      { module: "Customers", action: "View" },
      { module: "Customers", action: "Edit" },
    ]);
    const editor = await makeAdminUser(editorRole.id);
    await expect(grantReward(editor.id, customer.id, 10, "x", null)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("issues a coupon redeemable only by that customer", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();
    const otherCustomer = await makeCustomer();

    const coupon = await issueCoupon(admin.id, customer.id, { discountType: "PercentageOff", percentOff: 10, amountOff: null, expiresInDays: 30, usageLimit: 1 });
    expect(coupon.restrictedToUserId).toBe(customer.id);

    const fresh = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id }, include: { scopeProducts: true, scopeCategories: true } });
    const lines = [{ productId: "any-product", categoryIds: [], lineTotal: 1000 }];
    await expect(validateCoupon(fresh, lines, 1000, customer.id, null)).resolves.toBeDefined();
    await expect(validateCoupon(fresh, lines, 1000, otherCustomer.id, null)).rejects.toBeInstanceOf(CouponNotFoundError);
  });

  it("adds an internal note, absent from the customer's own profile read", async () => {
    const admin = await makeFullAccessAdmin();
    const customer = await makeCustomer();

    await addNote(admin.id, customer.id, "Called about a damaged order — offered a 10% coupon.");
    const detail = await getCustomerAdminDetail(admin.id, customer.id);
    expect(detail.notes).toHaveLength(1);

    const { getProfile } = await import("@/services/profile.service");
    const profile = await getProfile(customer.id);
    expect(profile).not.toHaveProperty("adminNotes");
  });
});
