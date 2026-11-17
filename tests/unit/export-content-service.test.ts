// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  ExportCertificationStripItemNotFoundError,
  ExportProcessStepNotFoundError,
  ExportSolutionCardNotFoundError,
} from "@/services/export-content.errors";
import {
  addCertificationStripItem,
  addProcessStep,
  addSolutionCard,
  getCertificationStripForStorefront,
  getCertificationsForStorefront,
  getPageHeroForStorefront,
  getProcessStepsForStorefront,
  getSolutionCardsForStorefront,
  removeCertificationStripItem,
  removeProcessStep,
  removeSolutionCard,
  reorderCertificationStripItems,
  reorderProcessSteps,
  reorderSolutionCards,
  updateCertificationStripItem,
  updatePageHeroSetting,
  updateProcessStep,
  updateSolutionCard,
} from "@/services/export-content.service";

const EMAIL_DOMAIN = "@export-content-svc-test.test";
const ROLE_KEY_PREFIX = "export-content-svc-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Export Content Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "ExportPortal", action: "View" },
    { module: "ExportPortal", action: "Edit" },
    { module: "ExportPortal", action: "Delete" },
  ]);
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.exportSolutionCard.deleteMany({});
  await prisma.exportProcessStep.deleteMany({});
  await prisma.exportCertificationStripItem.deleteMany({});
  await prisma.exportPageHeroSetting.deleteMany({});
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("export-content.service — page hero", () => {
  it("falls back to the page's original approved copy until an admin sets a field", async () => {
    await expect(getPageHeroForStorefront()).resolves.toMatchObject({
      eyebrow: "Export Solutions",
      headline: "Partner with Oristor for Global Distribution",
      primaryCtaLabel: "Explore Export Catalogue",
    });

    const admin = await makeFullAccessAdmin();
    await updatePageHeroSetting(admin.id, { headline: "Custom Headline" });

    await expect(getPageHeroForStorefront()).resolves.toMatchObject({
      headline: "Custom Headline",
      // Untouched fields keep falling back.
      eyebrow: "Export Solutions",
    });
  });

  it("rejects a View-only admin's write", async () => {
    const viewer = await makeAdmin([{ module: "ExportPortal", action: "View" }]);
    await expect(updatePageHeroSetting(viewer.id, { headline: "x" })).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("export-content.service — Export Solutions cards", () => {
  it("adds, updates, removes, and reorders cards, and audit-logs each change", async () => {
    const admin = await makeFullAccessAdmin();

    const first = await addSolutionCard(admin.id, { icon: "Package", title: "Bulk & Foodservice Supply", description: "First" });
    const second = await addSolutionCard(admin.id, { icon: "Tag", title: "Private Label / OEM", description: "Second" });
    expect(first.sortOrder).toBe(0);
    expect(second.sortOrder).toBe(1);

    const updated = await updateSolutionCard(admin.id, first.id, { title: "Bulk Supply (edited)", iconImageUrl: "/icons/custom.png" });
    expect(updated.title).toBe("Bulk Supply (edited)");
    expect(updated.iconImageUrl).toBe("/icons/custom.png");

    await reorderSolutionCards(admin.id, [second.id, first.id]);
    const reordered = await prisma.exportSolutionCard.findMany({ orderBy: { sortOrder: "asc" } });
    expect(reordered.map((c) => c.id)).toEqual([second.id, first.id]);

    await removeSolutionCard(admin.id, first.id);
    await expect(prisma.exportSolutionCard.findUnique({ where: { id: first.id } })).resolves.toBeNull();

    const logCount = await prisma.auditLog.count({ where: { actorId: admin.id, module: "ExportPortal" } });
    expect(logCount).toBeGreaterThanOrEqual(4);
  });

  it("rejects an unknown card id", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(updateSolutionCard(admin.id, "not-a-real-id", { title: "x" })).rejects.toBeInstanceOf(ExportSolutionCardNotFoundError);
  });

  it("the storefront getter only returns visible cards", async () => {
    const admin = await makeFullAccessAdmin();
    const visible = await addSolutionCard(admin.id, { icon: "Package", title: "Visible", description: "d" });
    await addSolutionCard(admin.id, { icon: "Tag", title: "Hidden", description: "d", visible: false });

    const result = await getSolutionCardsForStorefront();
    expect(result.map((c) => c.id)).toEqual([visible.id]);
  });
});

describe("export-content.service — Export Process steps", () => {
  it("adds, updates, removes, and reorders steps", async () => {
    const admin = await makeFullAccessAdmin();

    const first = await addProcessStep(admin.id, { icon: "FileText", title: "Inquiry", description: "First" });
    const second = await addProcessStep(admin.id, { icon: "FlaskConical", title: "Sample Evaluation", description: "Second" });
    expect(first.sortOrder).toBe(0);
    expect(second.sortOrder).toBe(1);

    const updated = await updateProcessStep(admin.id, first.id, { title: "Inquiry (edited)" });
    expect(updated.title).toBe("Inquiry (edited)");

    await reorderProcessSteps(admin.id, [second.id, first.id]);
    const reordered = await prisma.exportProcessStep.findMany({ orderBy: { sortOrder: "asc" } });
    expect(reordered.map((s) => s.id)).toEqual([second.id, first.id]);

    await removeProcessStep(admin.id, first.id);
    await expect(prisma.exportProcessStep.findUnique({ where: { id: first.id } })).resolves.toBeNull();
  });

  it("rejects an unknown step id", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(updateProcessStep(admin.id, "not-a-real-id", { title: "x" })).rejects.toBeInstanceOf(ExportProcessStepNotFoundError);
  });

  it("the storefront getter only returns visible steps", async () => {
    const admin = await makeFullAccessAdmin();
    const visible = await addProcessStep(admin.id, { icon: "FileText", title: "Visible", description: "d" });
    await addProcessStep(admin.id, { icon: "Truck", title: "Hidden", description: "d", visible: false });

    const result = await getProcessStepsForStorefront();
    expect(result.map((s) => s.id)).toEqual([visible.id]);
  });
});

describe("export-content.service — certification strip items", () => {
  it("adds, updates, removes, and reorders items, independent of Certification master data", async () => {
    const admin = await makeFullAccessAdmin();

    const first = await addCertificationStripItem(admin.id, { label: "ISO 22000", imageUrl: "/certs/iso.png" });
    const second = await addCertificationStripItem(admin.id, { label: "25+ Years of Trust" });
    expect(first.sortOrder).toBe(0);
    expect(second.sortOrder).toBe(1);

    const updated = await updateCertificationStripItem(admin.id, first.id, { label: "ISO 22000:2018" });
    expect(updated.label).toBe("ISO 22000:2018");

    await reorderCertificationStripItems(admin.id, [second.id, first.id]);
    const reordered = await prisma.exportCertificationStripItem.findMany({ orderBy: { sortOrder: "asc" } });
    expect(reordered.map((item) => item.id)).toEqual([second.id, first.id]);

    await removeCertificationStripItem(admin.id, first.id);
    await expect(prisma.exportCertificationStripItem.findUnique({ where: { id: first.id } })).resolves.toBeNull();
  });

  it("rejects an unknown item id", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(updateCertificationStripItem(admin.id, "not-a-real-id", { label: "x" })).rejects.toBeInstanceOf(ExportCertificationStripItemNotFoundError);
  });

  it("the storefront getter only returns visible items", async () => {
    const admin = await makeFullAccessAdmin();
    const visible = await addCertificationStripItem(admin.id, { label: "Visible" });
    await addCertificationStripItem(admin.id, { label: "Hidden", visible: false });

    const result = await getCertificationStripForStorefront();
    expect(result.map((item) => item.id)).toEqual([visible.id]);
  });
});

describe("export-content.service — certifications (footer only)", () => {
  it("only includes certifications that have a real logo image", async () => {
    const withLogo = await prisma.certification.create({ data: { name: "ISO 22000", certificateImage: "/certs/iso.png" } });
    await prisma.certification.create({ data: { name: "No Logo Yet", certificateImage: null } });

    const result = await getCertificationsForStorefront();
    expect(result.map((c) => c.id)).toContain(withLogo.id);
    expect(result.every((c) => c.certificateImage)).toBe(true);

    await prisma.certification.deleteMany({ where: { name: { in: ["ISO 22000", "No Logo Yet"] } } });
  });
});
