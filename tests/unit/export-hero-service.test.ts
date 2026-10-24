// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import { getExportHeroForStorefront, getExportHeroSettingForAdmin, updateExportHeroSettingForAdmin } from "@/services/export-hero.service";

const EMAIL_DOMAIN = "@export-hero-svc-test.test";
const ROLE_KEY_PREFIX = "export-hero-svc-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Export Hero Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function fullAccessAdmin() {
  return makeAdmin([
    { module: "HomepageBuilder", action: "View" },
    { module: "HomepageBuilder", action: "Edit" },
  ]);
}

afterEach(async () => {
  await prisma.exportHeroSetting.deleteMany({ where: { id: "global" } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("export-hero.service — admin permission gating", () => {
  it("rejects an admin without HomepageBuilder:View from reading the setting", async () => {
    const stranger = await makeAdmin([]);
    await expect(getExportHeroSettingForAdmin(stranger.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects an admin with only View from updating the setting", async () => {
    const viewer = await makeAdmin([{ module: "HomepageBuilder", action: "View" }]);
    await expect(updateExportHeroSettingForAdmin(viewer.id, { headline: "x" })).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("persists the setting and writes an audit log entry", async () => {
    const admin = await fullAccessAdmin();

    expect(await getExportHeroSettingForAdmin(admin.id)).toBeNull();

    const updated = await updateExportHeroSettingForAdmin(admin.id, {
      headline: "Bring the Taste of **Sri Lanka** to Your Market.",
      primaryCtaLabel: "Explore Export Catalogue",
      primaryCtaHref: "/export",
      statLine: [{ label: "Authentic Sri Lankan Range", description: "Distinctive local flavours" }],
    });
    expect(updated.headline).toBe("Bring the Taste of **Sri Lanka** to Your Market.");
    expect(updated.statLine).toEqual([{ label: "Authentic Sri Lankan Range", description: "Distinctive local flavours" }]);

    const logs = await prisma.auditLog.findMany({ where: { actorId: admin.id, action: "export_hero_settings_updated" } });
    expect(logs.length).toBe(1);
  });

  it("Prisma.DbNull round-trips correctly for clearing statLine back to empty", async () => {
    const admin = await fullAccessAdmin();
    await updateExportHeroSettingForAdmin(admin.id, { statLine: [{ label: "a", description: "b" }] });

    const cleared = await updateExportHeroSettingForAdmin(admin.id, { statLine: [] });
    expect(cleared.statLine).toBeNull();
  });
});

describe("export-hero.service — getExportHeroForStorefront (public)", () => {
  it("falls back to exportHeroDefaults when no setting row exists", async () => {
    const data = await getExportHeroForStorefront();
    expect(data.eyebrow).toBe("Oristor Export Solutions");
    expect(data.primaryCtaHref).toBe("/export");
    expect(data.statLine?.length).toBeGreaterThan(0);
    expect(data.badge).not.toBeNull();
  });

  it("prefers real data once an admin has set a field, while still falling back for unset fields", async () => {
    const admin = await fullAccessAdmin();
    await updateExportHeroSettingForAdmin(admin.id, { headline: "Custom Headline" });

    const data = await getExportHeroForStorefront();
    expect(data.headline).toBe("Custom Headline");
    // eyebrow was never set by this admin update — still the default.
    expect(data.eyebrow).toBe("Oristor Export Solutions");
  });
});
