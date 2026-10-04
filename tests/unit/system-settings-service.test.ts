// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  createFeatureFlag,
  createPaymentMethod,
  createTaxRateRule,
  deleteFeatureFlag,
  deletePaymentMethod,
  getCompanySetting,
  getFreeShippingThreshold,
  getLowStockThreshold,
  getResolvedCompanyInfo,
  isFeatureEnabled,
  listFeatureFlags,
  listPaymentMethods,
  updateCompanySetting,
  updateCurrencySetting,
  updateFreeShippingThreshold,
  updateLocaleSetting,
  updateLowStockThreshold,
  updatePaymentMethod,
  updateTaxDisplayMode,
} from "@/services/system-settings.service";
import { FeatureFlagKeyConflictError, PaymentMethodKeyConflictError } from "@/services/system-settings.errors";

const EMAIL_DOMAIN = "@system-settings-svc-test.test";
const ROLE_KEY_PREFIX = "system-settings-svc-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `System Settings Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "SystemSettings", action: "View" },
    { module: "SystemSettings", action: "Edit" },
  ]);
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.companySetting.deleteMany({});
  await prisma.currencySetting.deleteMany({});
  await prisma.localeSetting.deleteMany({});
  await prisma.taxSetting.deleteMany({});
  await prisma.taxRateRule.deleteMany({ where: { region: { startsWith: "system-settings-svc-test-" } } });
  await prisma.paymentMethodSetting.deleteMany({ where: { key: { startsWith: "system-settings-svc-test-" } } });
  await prisma.featureFlag.deleteMany({ where: { key: { startsWith: "system-settings-svc-test-" } } });
  await prisma.inventorySetting.deleteMany({});
  await prisma.shippingSetting.deleteMany({});
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("system-settings.service — Company", () => {
  it("upserts on first save, updates on second save, and audit-logs both", async () => {
    const admin = await makeFullAccessAdmin();

    const created = await updateCompanySetting(admin.id, { legalName: "Oristor Food Products (Pvt) Ltd" });
    expect(created.legalName).toBe("Oristor Food Products (Pvt) Ltd");

    const updated = await updateCompanySetting(admin.id, { legalName: "Oristor Foods", socialLinks: [{ label: "Facebook", href: "https://facebook.com/oristor" }] });
    expect(updated.legalName).toBe("Oristor Foods");
    expect(updated.socialLinks).toEqual([{ label: "Facebook", href: "https://facebook.com/oristor" }]);

    const logCount = await prisma.auditLog.count({ where: { actorId: admin.id, action: "company_setting_updated" } });
    expect(logCount).toBe(2);
  });

  it("rejects a View-only admin's write but allows the read", async () => {
    const viewer = await makeAdmin([{ module: "SystemSettings", action: "View" }]);
    await expect(getCompanySetting(viewer.id)).resolves.toBeNull();
    await expect(updateCompanySetting(viewer.id, { legalName: "x" })).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("STORY-074: the 4 Contact page fields round-trip and fall back to the page's original literal copy when unset", async () => {
    await expect(getResolvedCompanyInfo()).resolves.toMatchObject({
      contactHeroEyebrow: "Contact Us",
      contactHeroHeadline: "Let's talk about good food.",
      contactLocationHeading: "Come and meet us.",
    });

    const admin = await makeFullAccessAdmin();
    await updateCompanySetting(admin.id, { contactHeroEyebrow: "Say Hello", contactHeroHeadline: "Custom headline", contactHeroSubcopy: "Custom subcopy", contactLocationHeading: "Find us here" });

    await expect(getResolvedCompanyInfo()).resolves.toMatchObject({
      contactHeroEyebrow: "Say Hello",
      contactHeroHeadline: "Custom headline",
      contactHeroSubcopy: "Custom subcopy",
      contactLocationHeading: "Find us here",
    });
  });
});

describe("system-settings.service — Currencies / Languages / Taxes", () => {
  it("round-trips currency and locale settings", async () => {
    const admin = await makeFullAccessAdmin();
    const currency = await updateCurrencySetting(admin.id, { baseCurrency: "LKR", supportedCurrencies: ["LKR", "USD"] });
    expect(currency.supportedCurrencies).toEqual(["LKR", "USD"]);

    const locale = await updateLocaleSetting(admin.id, { defaultLocale: "en", supportedLocales: ["en", "si"] });
    expect(locale.supportedLocales).toEqual(["en", "si"]);
  });

  it("updates the tax display mode and creates/removes a tax rate rule", async () => {
    const admin = await makeFullAccessAdmin();
    const setting = await updateTaxDisplayMode(admin.id, "Inclusive");
    expect(setting.pricingDisplayMode).toBe("Inclusive");

    const rule = await createTaxRateRule(admin.id, { region: "system-settings-svc-test-colombo", category: null, ratePercent: 15, isActive: true });
    expect(rule.ratePercent.toString()).toBe("15");
  });
});

describe("system-settings.service — Shipping / Inventory", () => {
  it("round-trips the free-shipping threshold and the low-stock threshold", async () => {
    const admin = await makeFullAccessAdmin();
    await updateFreeShippingThreshold(admin.id, 7500);
    expect(await getFreeShippingThreshold(admin.id)).toBe(7500);

    await updateLowStockThreshold(admin.id, 5);
    expect(await getLowStockThreshold()).toBe(5);
  });

  it("getLowStockThreshold falls back to 10 when no row has ever been saved", async () => {
    expect(await getLowStockThreshold()).toBe(10);
  });
});

describe("system-settings.service — Payment methods", () => {
  it("creates, lists, updates, and deletes a payment method, assigning sequential sortOrder", async () => {
    const admin = await makeFullAccessAdmin();
    const first = await createPaymentMethod(admin.id, { key: "system-settings-svc-test-cod", label: "Cash on Delivery", enabled: true });
    const second = await createPaymentMethod(admin.id, { key: "system-settings-svc-test-bank", label: "Bank Transfer", enabled: true });
    expect(second.sortOrder).toBe(first.sortOrder + 1);

    const methods = await listPaymentMethods(admin.id);
    expect(methods.map((m) => m.key)).toContain("system-settings-svc-test-cod");

    const updated = await updatePaymentMethod(admin.id, first.id, { enabled: false });
    expect(updated.enabled).toBe(false);

    await deletePaymentMethod(admin.id, second.id);
    const remaining = await listPaymentMethods(admin.id);
    expect(remaining.some((m) => m.id === second.id)).toBe(false);
  });

  it("rejects a duplicate key", async () => {
    const admin = await makeFullAccessAdmin();
    await createPaymentMethod(admin.id, { key: "system-settings-svc-test-dup", label: "First", enabled: true });
    await expect(createPaymentMethod(admin.id, { key: "system-settings-svc-test-dup", label: "Second", enabled: true })).rejects.toBeInstanceOf(PaymentMethodKeyConflictError);
  });
});

describe("system-settings.service — Feature flags", () => {
  it("creates a flag, rejects a duplicate key, toggles it, and isFeatureEnabled reflects the change", async () => {
    const admin = await makeFullAccessAdmin();
    const flag = await createFeatureFlag(admin.id, { key: "system-settings-svc-test-flag", enabled: false, description: "A test flag." });
    expect(await isFeatureEnabled("system-settings-svc-test-flag")).toBe(false);

    await expect(createFeatureFlag(admin.id, { key: "system-settings-svc-test-flag", enabled: true, description: null })).rejects.toBeInstanceOf(FeatureFlagKeyConflictError);

    const flags = await listFeatureFlags(admin.id);
    expect(flags.some((f) => f.key === "system-settings-svc-test-flag")).toBe(true);

    await deleteFeatureFlag(admin.id, flag.id);
    expect(await isFeatureEnabled("system-settings-svc-test-flag")).toBe(false);
  });

  it("isFeatureEnabled returns false for a key that never existed", async () => {
    expect(await isFeatureEnabled("system-settings-svc-test-never-existed")).toBe(false);
  });
});
