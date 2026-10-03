// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import { diffVersions, getVersion, listVersions, recordVersion } from "@/services/versioning.service";
import { VersionNotFoundError } from "@/services/versioning.errors";

const EMAIL_DOMAIN = "@versioning-svc-test.test";
const ROLE_KEY_PREFIX = "versioning-svc-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Versioning Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

afterEach(async () => {
  await prisma.contentVersion.deleteMany({ where: { entityId: { startsWith: "versioning-svc-test-" } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("versioning.service — recordVersion / listVersions", () => {
  it("assigns sequential version numbers per (entityType, entityId) and lists them newest first", async () => {
    const admin = await makeAdmin([{ module: "Recipes", action: "View" }]);
    const entityId = "versioning-svc-test-entity-1";

    const v1 = await recordVersion("Recipe", entityId, { title: "First" }, admin.id);
    const v2 = await recordVersion("Recipe", entityId, { title: "Second" }, admin.id);

    expect(v1.versionNumber).toBe(1);
    expect(v2.versionNumber).toBe(2);

    const listed = await listVersions(admin.id, "Recipe", entityId);
    expect(listed.map((v) => v.versionNumber)).toEqual([2, 1]);
  });

  it("rejects listing for an admin without View on the entity type's own module", async () => {
    const admin = await makeAdmin([]);
    await expect(listVersions(admin.id, "Recipe", "versioning-svc-test-entity-2")).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("versioning.service — getVersion", () => {
  it("throws VersionNotFoundError for a version belonging to a different entityType", async () => {
    const admin = await makeAdmin([{ module: "Recipes", action: "View" }, { module: "Blog", action: "View" }]);
    const entityId = "versioning-svc-test-entity-3";
    const version = await recordVersion("BlogPost", entityId, { title: "A post" }, admin.id);

    await expect(getVersion(admin.id, "Recipe", version.id)).rejects.toBeInstanceOf(VersionNotFoundError);
    await expect(getVersion(admin.id, "BlogPost", version.id)).resolves.toMatchObject({ id: version.id });
  });
});

describe("versioning.service — diffVersions", () => {
  it("reports added, removed, and changed top-level fields, and nested-object fields by dotted path", async () => {
    const admin = await makeAdmin([{ module: "Recipes", action: "View" }]);
    const entityId = "versioning-svc-test-entity-4";

    const v1 = await recordVersion("Recipe", entityId, { title: "Old Title", nutrition: { calories: 100 }, removedField: "gone soon" }, admin.id);
    const v2 = await recordVersion("Recipe", entityId, { title: "New Title", nutrition: { calories: 150 } }, admin.id);

    const diff = await diffVersions(admin.id, "Recipe", v1.id, v2.id);
    const byPath = (path: string) => diff.find((entry) => entry.path === path);

    expect(byPath("title")).toEqual({ path: "title", before: "Old Title", after: "New Title" });
    expect(byPath("nutrition.calories")).toEqual({ path: "nutrition.calories", before: 100, after: 150 });
    expect(byPath("removedField")).toEqual({ path: "removedField", before: "gone soon", after: undefined });
  });

  it("reports no differences for two identical snapshots", async () => {
    const admin = await makeAdmin([{ module: "Recipes", action: "View" }]);
    const entityId = "versioning-svc-test-entity-5";

    const v1 = await recordVersion("Recipe", entityId, { title: "Same" }, admin.id);
    const v2 = await recordVersion("Recipe", entityId, { title: "Same" }, admin.id);

    const diff = await diffVersions(admin.id, "Recipe", v1.id, v2.id);
    expect(diff).toEqual([]);
  });
});
