// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  createZone,
  deleteZone,
  getCoverageGaps,
  listZonesForAdmin,
  setZoneActive,
  updateZone,
} from "@/services/delivery-zone.service";
import { DeliveryZoneCityConflictError } from "@/services/delivery-zone.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const EMAIL_DOMAIN = "@delivery-zone-svc-test.test";
const ROLE_KEY_PREFIX = "delivery-zone-svc-test-role-";
const ZONE_NAME_PREFIX = "Delivery Zone Svc Test Zone ";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Delivery Zone Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "DeliveryZones", action: "View" },
    { module: "DeliveryZones", action: "Edit" },
    { module: "DeliveryZones", action: "Delete" },
  ]);
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.deliveryZone.deleteMany({ where: { name: { startsWith: ZONE_NAME_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("delivery-zone.service", () => {
  it("creates, lists, and updates a zone, and writes audit log entries", async () => {
    const admin = await makeFullAccessAdmin();

    const created = await createZone(admin.id, { name: `${ZONE_NAME_PREFIX}Colombo`, cities: ["Colombo", "Dehiwala"], isActive: true });
    expect(created.cities).toEqual(["Colombo", "Dehiwala"]);

    const list = await listZonesForAdmin(admin.id);
    expect(list.some((zone) => zone.id === created.id)).toBe(true);

    const updated = await updateZone(admin.id, created.id, { cities: ["Colombo", "Dehiwala", "Moratuwa"] });
    expect(updated.cities).toEqual(["Colombo", "Dehiwala", "Moratuwa"]);

    const logCount = await prisma.auditLog.count({ where: { actorId: admin.id, targetId: created.id } });
    expect(logCount).toBe(2);
  });

  it("blocks creating a zone whose city is already covered by another active zone", async () => {
    const admin = await makeFullAccessAdmin();
    await createZone(admin.id, { name: `${ZONE_NAME_PREFIX}Alpha`, cities: ["Kandy"], isActive: true });

    await expect(createZone(admin.id, { name: `${ZONE_NAME_PREFIX}Beta`, cities: ["Kandy"], isActive: true })).rejects.toBeInstanceOf(DeliveryZoneCityConflictError);
  });

  it("allows an inactive zone to share a city with an active zone, but blocks activating it", async () => {
    const admin = await makeFullAccessAdmin();
    await createZone(admin.id, { name: `${ZONE_NAME_PREFIX}Gamma`, cities: ["Galle"], isActive: true });
    const inactive = await createZone(admin.id, { name: `${ZONE_NAME_PREFIX}Delta`, cities: ["Galle"], isActive: false });

    await expect(setZoneActive(admin.id, inactive.id, true)).rejects.toBeInstanceOf(DeliveryZoneCityConflictError);
  });

  it("always allows deactivating a zone, freeing its cities", async () => {
    const admin = await makeFullAccessAdmin();
    const zone = await createZone(admin.id, { name: `${ZONE_NAME_PREFIX}Epsilon`, cities: ["Negombo"], isActive: true });

    const deactivated = await setZoneActive(admin.id, zone.id, false);
    expect(deactivated.isActive).toBe(false);
  });

  it("deletes a zone", async () => {
    const admin = await makeFullAccessAdmin();
    const zone = await createZone(admin.id, { name: `${ZONE_NAME_PREFIX}Zeta`, cities: ["Jaffna"], isActive: true });

    await deleteZone(admin.id, zone.id);
    const list = await listZonesForAdmin(admin.id);
    expect(list.some((z) => z.id === zone.id)).toBe(false);
  });

  it("rejects a View-only admin's write but allows the read", async () => {
    const viewer = await makeAdmin([{ module: "DeliveryZones", action: "View" }]);
    await expect(listZonesForAdmin(viewer.id)).resolves.toBeInstanceOf(Array);
    await expect(createZone(viewer.id, { name: `${ZONE_NAME_PREFIX}Eta`, cities: ["Matara"], isActive: true })).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("surfaces a coverage gap for a real address city with no active zone, and clears it once a covering zone is created", async () => {
    const admin = await makeFullAccessAdmin();
    sequence += 1;
    const customer = await prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}` } });
    const gapCity = `DeliveryZoneSvcTestGapCity${sequence}`;
    await prisma.address.create({
      data: {
        userId: customer.id,
        recipientName: "Test Customer",
        phone: "+94 77 000 0000",
        line1: "1 Test Lane",
        city: gapCity,
      },
    });

    const gapsBefore = await getCoverageGaps(admin.id);
    expect(gapsBefore).toContain(gapCity);

    await createZone(admin.id, { name: `${ZONE_NAME_PREFIX}Theta`, cities: [gapCity], isActive: true });
    const gapsAfter = await getCoverageGaps(admin.id);
    expect(gapsAfter).not.toContain(gapCity);

    await prisma.address.deleteMany({ where: { userId: customer.id } });
    await prisma.user.delete({ where: { id: customer.id } });
  });
});
