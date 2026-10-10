// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import { AllergenNameConflictError, AllergenNotFoundError, CertificationNotFoundError } from "@/services/product-taxonomy.errors";
import {
  createAllergenAdmin,
  createCertificationAdmin,
  listAllergensForAdmin,
  listCertificationsForAdmin,
  updateAllergenAdmin,
  updateCertificationAdmin,
} from "@/services/product-taxonomy.service";

const EMAIL_DOMAIN = "@taxonomy-svc-test.test";
const ROLE_KEY_PREFIX = "taxonomy-svc-test-role-";
const NAME_PREFIX = "Taxonomy Test ";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Taxonomy Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "Products", action: "View" },
    { module: "Products", action: "Edit" },
  ]);
}

function name(label: string) {
  sequence += 1;
  return `${NAME_PREFIX}${label} ${sequence}`;
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.allergen.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
  await prisma.certification.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("product-taxonomy.service — allergens", () => {
  it("a View-only admin can list but not create", async () => {
    const viewer = await makeAdmin([{ module: "Products", action: "View" }]);
    await expect(listAllergensForAdmin(viewer.id)).resolves.toBeInstanceOf(Array);
    await expect(createAllergenAdmin(viewer.id, { name: name("x") })).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("creates, lists, and updates an allergen, audit-logging both actions", async () => {
    const admin = await makeFullAccessAdmin();
    const allergen = await createAllergenAdmin(admin.id, { name: name("Peanuts"), icon: "/media-files/peanut.svg" });
    const list = await listAllergensForAdmin(admin.id);
    expect(list.some((a) => a.id === allergen.id)).toBe(true);

    const updated = await updateAllergenAdmin(admin.id, allergen.id, { icon: "/media-files/peanut-v2.svg" });
    expect(updated.icon).toBe("/media-files/peanut-v2.svg");

    const logCount = await prisma.auditLog.count({ where: { actorId: admin.id, targetId: allergen.id } });
    expect(logCount).toBe(2);
  });

  it("rejects a duplicate name on create and on rename", async () => {
    const admin = await makeFullAccessAdmin();
    const dupName = name("Dairy");
    await createAllergenAdmin(admin.id, { name: dupName });
    await expect(createAllergenAdmin(admin.id, { name: dupName })).rejects.toBeInstanceOf(AllergenNameConflictError);

    const other = await createAllergenAdmin(admin.id, { name: name("Other") });
    await expect(updateAllergenAdmin(admin.id, other.id, { name: dupName })).rejects.toBeInstanceOf(AllergenNameConflictError);
  });

  it("allows renaming an allergen to the same name it already has", async () => {
    const admin = await makeFullAccessAdmin();
    const ownName = name("SelfRename");
    const allergen = await createAllergenAdmin(admin.id, { name: ownName });
    await expect(updateAllergenAdmin(admin.id, allergen.id, { name: ownName, icon: "/media-files/x.svg" })).resolves.toMatchObject({ icon: "/media-files/x.svg" });
  });

  it("throws AllergenNotFoundError updating one that doesn't exist", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(updateAllergenAdmin(admin.id, "does-not-exist", { name: name("x") })).rejects.toBeInstanceOf(AllergenNotFoundError);
  });
});

describe("product-taxonomy.service — certifications", () => {
  it("creates, lists, and updates a certification (no uniqueness constraint on name, unlike Allergen)", async () => {
    const admin = await makeFullAccessAdmin();
    const certification = await createCertificationAdmin(admin.id, { name: name("ISO 22000"), documentUrl: "https://example.com/cert.pdf" });
    const list = await listCertificationsForAdmin(admin.id);
    expect(list.some((c) => c.id === certification.id)).toBe(true);

    const updated = await updateCertificationAdmin(admin.id, certification.id, { certificateImage: "/media-files/badge.png" });
    expect(updated.certificateImage).toBe("/media-files/badge.png");
  });

  it("throws CertificationNotFoundError updating one that doesn't exist", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(updateCertificationAdmin(admin.id, "does-not-exist", { name: name("x") })).rejects.toBeInstanceOf(CertificationNotFoundError);
  });

  it("clears a blank optional field back to null", async () => {
    const admin = await makeFullAccessAdmin();
    const certification = await createCertificationAdmin(admin.id, { name: name("Clearable"), documentUrl: "https://example.com/x.pdf" });
    const updated = await updateCertificationAdmin(admin.id, certification.id, { documentUrl: "" });
    expect(updated.documentUrl).toBeNull();
  });
});
