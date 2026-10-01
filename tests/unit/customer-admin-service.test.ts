// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import { CustomerNotFoundError } from "@/services/customer-admin.errors";
import { setCustomerGroup } from "@/services/customer-admin.service";

const EMAIL_DOMAIN = "@customer-admin-svc-test.test";
const ROLE_KEY_PREFIX = "customer-admin-svc-test-role-";
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

async function makeCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}`, name: `Test Customer ${sequence}` } });
}

afterEach(async () => {
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
