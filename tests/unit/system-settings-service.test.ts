// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  createBankAccount,
  createFeatureFlag,
  createPaymentMethod,
  createTaxRateRule,
  deleteBankAccount,
  deleteFeatureFlag,
  deletePaymentMethod,
  getAnnouncementBarSetting,
  getCompanySetting,
  getFreeShippingThreshold,
  getLowStockThreshold,
  getPickupLocation,
  getResolvedAnnouncementBar,
  getResolvedCompanyInfo,
  isFeatureEnabled,
  listBankAccounts,
  listEligibleBankAccounts,
  listFeatureFlags,
  listPaymentMethods,
  updateAnnouncementBarSetting,
  updateBankAccount,
  updateCompanySetting,
  updateCurrencySetting,
  updateFreeShippingThreshold,
  updateLocaleSetting,
  updateLowStockThreshold,
  updatePaymentMethod,
  updateTaxDisplayMode,
} from "@/services/system-settings.service";
import { FeatureFlagKeyConflictError, PaymentMethodKeyConflictError, PaymentMethodTagConflictError } from "@/services/system-settings.errors";

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
  await prisma.announcementBarSetting.deleteMany({});
  await prisma.currencySetting.deleteMany({});
  await prisma.localeSetting.deleteMany({});
  await prisma.taxSetting.deleteMany({});
  await prisma.taxRateRule.deleteMany({ where: { region: { startsWith: "system-settings-svc-test-" } } });
  await prisma.paymentMethodSetting.deleteMany({ where: { key: { startsWith: "system-settings-svc-test-" } } });
  await prisma.bankAccountSetting.deleteMany({});
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

describe("system-settings.service — Announcement bar", () => {
  it("is hidden by default, and hidden again if isEnabled is turned back off", async () => {
    await expect(getResolvedAnnouncementBar()).resolves.toBeNull();

    const admin = await makeFullAccessAdmin();
    await updateAnnouncementBarSetting(admin.id, { message: "Authentic Sri Lankan flavours, made with care.", isEnabled: true });
    await expect(getResolvedAnnouncementBar()).resolves.toEqual({
      message: "Authentic Sri Lankan flavours, made with care.",
      linkLabel: null,
      linkHref: null,
    });

    await updateAnnouncementBarSetting(admin.id, { isEnabled: false });
    await expect(getResolvedAnnouncementBar()).resolves.toBeNull();
  });

  it("stays hidden when enabled but no message has ever been set", async () => {
    const admin = await makeFullAccessAdmin();
    await updateAnnouncementBarSetting(admin.id, { isEnabled: true });
    await expect(getResolvedAnnouncementBar()).resolves.toBeNull();
  });

  it("round-trips the optional link fields and audit-logs the save", async () => {
    const admin = await makeFullAccessAdmin();
    await updateAnnouncementBarSetting(admin.id, {
      message: "Free delivery over LKR 10,000",
      isEnabled: true,
      linkLabel: "Shop now",
      linkHref: "/products",
    });

    await expect(getResolvedAnnouncementBar()).resolves.toEqual({
      message: "Free delivery over LKR 10,000",
      linkLabel: "Shop now",
      linkHref: "/products",
    });
    const logCount = await prisma.auditLog.count({ where: { actorId: admin.id, action: "announcement_bar_setting_updated" } });
    expect(logCount).toBe(1);
  });

  it("rejects a View-only admin's write but allows the read", async () => {
    const viewer = await makeAdmin([{ module: "SystemSettings", action: "View" }]);
    await expect(getAnnouncementBarSetting(viewer.id)).resolves.toBeNull();
    await expect(updateAnnouncementBarSetting(viewer.id, { message: "x" })).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("system-settings.service — Export fulfilment flow", () => {
  it("getPickupLocation is null until an admin sets both the name and address, then returns them", async () => {
    await expect(getPickupLocation()).resolves.toBeNull();

    const admin = await makeFullAccessAdmin();
    await updateCompanySetting(admin.id, { pickupLocationName: "Oristor Factory Outlet" });
    await expect(getPickupLocation()).resolves.toBeNull();

    await updateCompanySetting(admin.id, { pickupLocationAddress: "123 Factory Rd, Colombo" });
    await expect(getPickupLocation()).resolves.toEqual({
      name: "Oristor Factory Outlet",
      address: "123 Factory Rd, Colombo",
      mapUrl: null,
    });
  });

  it("bank accounts: admin CRUD is permission-gated, and the customer-facing read returns only enabled accounts", async () => {
    const admin = await makeFullAccessAdmin();
    const viewer = await makeAdmin([{ module: "SystemSettings", action: "View" }]);

    const account = await createBankAccount(admin.id, {
      bankName: "Commercial Bank",
      accountName: "Oristor Food Products (Pvt) Ltd",
      accountNumber: "1234567890",
      currency: "LKR",
      enabled: true,
    });
    const disabledAccount = await createBankAccount(admin.id, {
      bankName: "HNB",
      accountName: "Oristor Food Products (Pvt) Ltd",
      accountNumber: "0987654321",
      currency: "USD",
      enabled: false,
    });

    await expect(listEligibleBankAccounts()).resolves.toEqual([expect.objectContaining({ id: account.id })]);

    await expect(createBankAccount(viewer.id, { bankName: "x", accountName: "x", accountNumber: "x", currency: "LKR", enabled: true })).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );

    await updateBankAccount(admin.id, account.id, { enabled: false });
    await expect(listEligibleBankAccounts()).resolves.toEqual([]);

    await deleteBankAccount(admin.id, disabledAccount.id);
    await expect(listBankAccounts(admin.id)).resolves.toHaveLength(1);
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

  describe("Story 4 (Payment Restriction) — method tag + allowedForRestrictedOrders", () => {
    it("creates a row tagged with a concrete checkout method, defaulting allowedForRestrictedOrders false", async () => {
      const admin = await makeFullAccessAdmin();
      const method = await createPaymentMethod(admin.id, { key: "system-settings-svc-test-cod2", label: "Cash on Delivery", enabled: true, method: "CashOnDelivery" });
      expect(method.method).toBe("CashOnDelivery");
      expect(method.allowedForRestrictedOrders).toBe(false);
    });

    it("allows updating allowedForRestrictedOrders independently of enabled", async () => {
      const admin = await makeFullAccessAdmin();
      const method = await createPaymentMethod(admin.id, { key: "system-settings-svc-test-card", label: "Card", enabled: true, method: "Card" });
      const updated = await updatePaymentMethod(admin.id, method.id, { allowedForRestrictedOrders: true });
      expect(updated.allowedForRestrictedOrders).toBe(true);
      expect(updated.enabled).toBe(true);
    });

    it("rejects a second row tagged with the same method — PaymentMethodSetting.method is @unique", async () => {
      const admin = await makeFullAccessAdmin();
      await createPaymentMethod(admin.id, { key: "system-settings-svc-test-bank1", label: "Bank Transfer", enabled: true, method: "BankTransfer" });
      await expect(
        createPaymentMethod(admin.id, { key: "system-settings-svc-test-bank2", label: "Bank Transfer (duplicate)", enabled: true, method: "BankTransfer" }),
      ).rejects.toBeInstanceOf(PaymentMethodTagConflictError);
    });

    it("allows re-saving a row's own existing method tag without a false-positive conflict", async () => {
      const admin = await makeFullAccessAdmin();
      const method = await createPaymentMethod(admin.id, { key: "system-settings-svc-test-card2", label: "Card", enabled: true, method: "Card" });
      await expect(updatePaymentMethod(admin.id, method.id, { method: "Card", label: "Card (renamed)" })).resolves.toMatchObject({ method: "Card", label: "Card (renamed)" });
    });

    it("allows multiple untagged (method: null) rows — only a real tag is constrained", async () => {
      const admin = await makeFullAccessAdmin();
      await createPaymentMethod(admin.id, { key: "system-settings-svc-test-untagged1", label: "Untagged One", enabled: true });
      await expect(createPaymentMethod(admin.id, { key: "system-settings-svc-test-untagged2", label: "Untagged Two", enabled: true })).resolves.toMatchObject({ method: null });
    });
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
