// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import { getSeoMeta, updateSeoMeta } from "@/services/seo.service";
import { computeSeoHealth } from "@/lib/seo-health";

const EMAIL_DOMAIN = "@seo-svc-test.test";
const ROLE_KEY_PREFIX = "seo-svc-test-role-";
const NAME_PREFIX = "SEO Svc Test ";
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
    { module: "SEO", action: "View" },
    { module: "SEO", action: "Edit" },
  ]);
  return makeAdminUser(role.id);
}

async function makeViewOnlyAdmin() {
  const role = await makeRole([{ module: "SEO", action: "View" }]);
  return makeAdminUser(role.id);
}

afterEach(async () => {
  await prisma.seoMeta.deleteMany({ where: { entityId: { startsWith: "seo-svc-test-" } } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("seo.service — getSeoMeta / updateSeoMeta", () => {
  it("returns null for an entity with no SeoMeta row yet", async () => {
    const admin = await makeFullAccessAdmin();
    const result = await getSeoMeta(admin.id, "Product", "seo-svc-test-missing-entity");
    expect(result).toBeNull();
  });

  it("upserts on first save, updates on second save, and audit-logs both", async () => {
    const admin = await makeFullAccessAdmin();
    const entityId = "seo-svc-test-entity-1";

    const created = await updateSeoMeta(admin.id, "Product", entityId, {
      metaTitle: "First Title",
      metaDescription: null,
      canonicalUrl: null,
      ogImageUrl: null,
      ogImageAlt: null,
      robotsIndex: true,
      robotsFollow: true,
      focusKeyword: null,
    });
    expect(created.metaTitle).toBe("First Title");

    const updated = await updateSeoMeta(admin.id, "Product", entityId, {
      metaTitle: "Second Title",
      metaDescription: "A description.",
      canonicalUrl: null,
      ogImageUrl: null,
      ogImageAlt: null,
      robotsIndex: false,
      robotsFollow: true,
      focusKeyword: null,
    });
    expect(updated.id).toBe(created.id);
    expect(updated.metaTitle).toBe("Second Title");
    expect(updated.robotsIndex).toBe(false);

    const fetched = await getSeoMeta(admin.id, "Product", entityId);
    expect(fetched?.metaTitle).toBe("Second Title");

    const logCount = await prisma.auditLog.count({ where: { actorId: admin.id, action: "seo_meta_updated", targetId: created.id } });
    expect(logCount).toBe(2);
  });

  it("rejects a View-only admin's write but allows the read", async () => {
    const viewer = await makeViewOnlyAdmin();
    await expect(getSeoMeta(viewer.id, "Recipe", "seo-svc-test-entity-2")).resolves.toBeNull();
    await expect(
      updateSeoMeta(viewer.id, "Recipe", "seo-svc-test-entity-2", {
        metaTitle: null,
        metaDescription: null,
        canonicalUrl: null,
        ogImageUrl: null,
        ogImageAlt: null,
        robotsIndex: true,
        robotsFollow: true,
        focusKeyword: null,
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("computeSeoHealth", () => {
  const base = { metaTitle: null, metaDescription: null, canonicalUrl: null, ogImageUrl: null, ogImageAlt: null };

  it("flags a missing description, an unset canonical, and a too-short title", () => {
    const checks = computeSeoHealth({ ...base, metaTitle: "Too short" });
    expect(checks.find((c) => c.id === "missingDescription")?.ok).toBe(false);
    expect(checks.find((c) => c.id === "noCanonical")?.ok).toBe(false);
    expect(checks.find((c) => c.id === "titleLength")?.ok).toBe(false);
  });

  it("passes a title in the 50-60 char range", () => {
    const checks = computeSeoHealth({ ...base, metaTitle: "A".repeat(55) });
    expect(checks.find((c) => c.id === "titleLength")?.ok).toBe(true);
  });

  it("treats an empty title as ok (nothing to flag yet) but flags a missing alt text only when an OG image is set", () => {
    const empty = computeSeoHealth(base);
    expect(empty.find((c) => c.id === "titleLength")?.ok).toBe(true);
    expect(empty.find((c) => c.id === "missingOgAlt")?.ok).toBe(true);

    const withImageNoAlt = computeSeoHealth({ ...base, ogImageUrl: "https://example.com/x.jpg" });
    expect(withImageNoAlt.find((c) => c.id === "missingOgAlt")?.ok).toBe(false);

    const withImageAndAlt = computeSeoHealth({ ...base, ogImageUrl: "https://example.com/x.jpg", ogImageAlt: "A photo" });
    expect(withImageAndAlt.find((c) => c.id === "missingOgAlt")?.ok).toBe(true);
  });

  it("passes everything when all fields are well-formed", () => {
    const checks = computeSeoHealth({
      metaTitle: "A".repeat(55),
      metaDescription: "A fine description.",
      canonicalUrl: "https://oristor.com/products/x",
      ogImageUrl: "https://example.com/x.jpg",
      ogImageAlt: "A photo",
    });
    expect(checks.every((c) => c.ok)).toBe(true);
  });
});
