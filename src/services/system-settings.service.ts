import { Prisma, type TaxPricingDisplayMode } from "@/generated/prisma/client";
import { contactInfo as staticContactInfo } from "@/lib/footer-config";
import * as systemSettingsRepository from "@/repositories/system-settings.repository";
import * as shippingRepository from "@/repositories/shipping.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { FeatureFlagKeyConflictError, PaymentMethodKeyConflictError } from "@/services/system-settings.errors";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-054. One permission-gated (SystemSettings, View/Edit), audit-
 * logged function per category — mirrors rewards.service.ts's
 * updateRewardSetting shape exactly. AdminModule.SystemSettings was a
 * pre-reserved, zero-usage enum value until this story (same situation
 * CMSWorkflow was in before STORY-053).
 */

// --- Company ---

export interface CompanySettingInput {
  legalName?: string | null;
  brandName?: string | null;
  logoUrl?: string | null;
  logoAlt?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  businessRegistrationId?: string | null;
  taxId?: string | null;
  socialLinks?: { label: string; href: string }[] | null;
  contactHeroEyebrow?: string | null;
  contactHeroHeadline?: string | null;
  contactHeroSubcopy?: string | null;
  contactLocationHeading?: string | null;
}

export async function getCompanySetting(adminUserId: string) {
  await requirePermission(adminUserId, "SystemSettings", "View");
  return systemSettingsRepository.getCompanySetting();
}

export async function updateCompanySetting(adminUserId: string, input: CompanySettingInput) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  // Prisma.DbNull (not JS null) clears a nullable Json column back to SQL NULL — see seo.repository.ts's own comment on the same gotcha.
  const updated = await systemSettingsRepository.updateCompanySetting({ ...input, socialLinks: input.socialLinks === null ? Prisma.DbNull : input.socialLinks });
  await writeAuditLog({ actorId: adminUserId, action: "company_setting_updated", module: "SystemSettings", targetType: "CompanySetting", targetId: "global" });
  return updated;
}

/**
 * Storefront-facing — no admin permission check, feeds the real
 * footer's contact block. Falls back to footer-config.ts's static
 * defaults field-by-field until an admin has saved a value, same
 * zero-downtime cutover STORY-052 used for nav/footer links.
 *
 * `CompanySetting.socialLinks` is captured by the admin form (see
 * `getCompanySetting`/`updateCompanySetting` above) but deliberately
 * NOT wired to the storefront's own `<SocialLinks>` component here —
 * that component's icons are fixed Lucide/brand-icon components keyed
 * by platform, the same Server→Client icon-serialization constraint
 * STORY-052 hit for nav items, and rewiring it isn't something this
 * story's AC asks for. The field exists for the admin's own record;
 * wiring it live is a future, separate decision.
 */
export async function getResolvedCompanyInfo() {
  const setting = await systemSettingsRepository.getCompanySetting();
  return {
    companyName: setting?.legalName ?? staticContactInfo.companyName,
    address: setting?.address ?? staticContactInfo.address,
    phone: setting?.phone ?? staticContactInfo.phone,
    email: setting?.email ?? staticContactInfo.email,
    // STORY-072. No static fallback for either — unlike the fields above,
    // nothing was ever configured anywhere for these, so null means "an
    // admin hasn't set this yet," never a fabricated value.
    businessHours: setting?.businessHours ?? null,
    socialLinks: (setting?.socialLinks as { label: string; href: string }[] | null) ?? null,
    // STORY-074. Contact page copy, admin-editable via /admin/story-pages.
    // Falls back to the page's own original literal copy until an admin
    // saves a value — same zero-downtime cutover as every field above.
    contactHeroEyebrow: setting?.contactHeroEyebrow ?? "Contact Us",
    contactHeroHeadline: setting?.contactHeroHeadline ?? "Let's talk about good food.",
    contactHeroSubcopy:
      setting?.contactHeroSubcopy ??
      "From authentic Sri Lankan flavours to international partnerships, we'd love to hear from you.",
    contactLocationHeading: setting?.contactLocationHeading ?? "Come and meet us.",
  };
}

// --- Currencies ---

export interface CurrencySettingInput {
  baseCurrency?: string;
  supportedCurrencies?: string[];
  manualExchangeRates?: Record<string, number> | null;
}

export async function getCurrencySetting(adminUserId: string) {
  await requirePermission(adminUserId, "SystemSettings", "View");
  return systemSettingsRepository.getCurrencySetting();
}

export async function updateCurrencySetting(adminUserId: string, input: CurrencySettingInput) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  const updated = await systemSettingsRepository.updateCurrencySetting({ ...input, manualExchangeRates: input.manualExchangeRates === null ? Prisma.DbNull : input.manualExchangeRates });
  await writeAuditLog({ actorId: adminUserId, action: "currency_setting_updated", module: "SystemSettings", targetType: "CurrencySetting", targetId: "global" });
  return updated;
}

// --- Languages ---

export interface LocaleSettingInput {
  defaultLocale?: string;
  supportedLocales?: string[];
}

export async function getLocaleSetting(adminUserId: string) {
  await requirePermission(adminUserId, "SystemSettings", "View");
  return systemSettingsRepository.getLocaleSetting();
}

export async function updateLocaleSetting(adminUserId: string, input: LocaleSettingInput) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  const updated = await systemSettingsRepository.updateLocaleSetting(input);
  await writeAuditLog({ actorId: adminUserId, action: "locale_setting_updated", module: "SystemSettings", targetType: "LocaleSetting", targetId: "global" });
  return updated;
}

// --- Taxes ---

export async function getTaxSettings(adminUserId: string) {
  await requirePermission(adminUserId, "SystemSettings", "View");
  const [setting, rules] = await Promise.all([systemSettingsRepository.getTaxSetting(), systemSettingsRepository.listTaxRateRules()]);
  return { setting, rules };
}

export async function updateTaxDisplayMode(adminUserId: string, pricingDisplayMode: TaxPricingDisplayMode) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  const updated = await systemSettingsRepository.updateTaxSetting(pricingDisplayMode);
  await writeAuditLog({ actorId: adminUserId, action: "tax_setting_updated", module: "SystemSettings", targetType: "TaxSetting", targetId: "global" });
  return updated;
}

export interface TaxRateRuleInput {
  region: string;
  category: string | null;
  ratePercent: number;
  isActive: boolean;
}

export async function createTaxRateRule(adminUserId: string, input: TaxRateRuleInput) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  const rule = await systemSettingsRepository.createTaxRateRule({ ...input, ratePercent: input.ratePercent.toFixed(2) });
  await writeAuditLog({ actorId: adminUserId, action: "tax_rate_rule_created", module: "SystemSettings", targetType: "TaxRateRule", targetId: rule.id });
  return rule;
}

export async function updateTaxRateRule(adminUserId: string, id: string, input: Partial<TaxRateRuleInput>) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  const rule = await systemSettingsRepository.updateTaxRateRule(id, { ...input, ratePercent: input.ratePercent?.toFixed(2) });
  await writeAuditLog({ actorId: adminUserId, action: "tax_rate_rule_updated", module: "SystemSettings", targetType: "TaxRateRule", targetId: id });
  return rule;
}

export async function deleteTaxRateRule(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  await systemSettingsRepository.deleteTaxRateRule(id);
  await writeAuditLog({ actorId: adminUserId, action: "tax_rate_rule_deleted", module: "SystemSettings", targetType: "TaxRateRule", targetId: id });
}

// --- Shipping (the global free-shipping threshold only — zone rates are STORY-055's) ---

export async function getFreeShippingThreshold(adminUserId: string) {
  await requirePermission(adminUserId, "SystemSettings", "View");
  return shippingRepository.getFreeShippingThreshold();
}

export async function updateFreeShippingThreshold(adminUserId: string, value: number) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  const updated = await shippingRepository.updateFreeShippingThreshold(value);
  await writeAuditLog({ actorId: adminUserId, action: "free_shipping_threshold_updated", module: "SystemSettings", targetType: "ShippingSetting", targetId: "global" });
  return updated;
}

// --- Payment methods ---

export async function listPaymentMethods(adminUserId: string) {
  await requirePermission(adminUserId, "SystemSettings", "View");
  return systemSettingsRepository.listPaymentMethods();
}

export async function createPaymentMethod(adminUserId: string, input: { key: string; label: string; enabled: boolean }) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  const existing = await systemSettingsRepository.listPaymentMethods();
  if (existing.some((method) => method.key === input.key)) throw new PaymentMethodKeyConflictError();

  const sortOrder = await systemSettingsRepository.nextPaymentMethodSortOrder();
  const method = await systemSettingsRepository.createPaymentMethod({ ...input, sortOrder });
  await writeAuditLog({ actorId: adminUserId, action: "payment_method_created", module: "SystemSettings", targetType: "PaymentMethodSetting", targetId: method.id });
  return method;
}

export async function updatePaymentMethod(adminUserId: string, id: string, input: { label?: string; enabled?: boolean }) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  const method = await systemSettingsRepository.updatePaymentMethod(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "payment_method_updated", module: "SystemSettings", targetType: "PaymentMethodSetting", targetId: id });
  return method;
}

export async function deletePaymentMethod(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  await systemSettingsRepository.deletePaymentMethod(id);
  await writeAuditLog({ actorId: adminUserId, action: "payment_method_deleted", module: "SystemSettings", targetType: "PaymentMethodSetting", targetId: id });
}

// --- Feature flags ---

export async function listFeatureFlags(adminUserId: string) {
  await requirePermission(adminUserId, "SystemSettings", "View");
  return systemSettingsRepository.listFeatureFlags();
}

export async function createFeatureFlag(adminUserId: string, input: { key: string; enabled: boolean; description: string | null }) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  const existing = await systemSettingsRepository.findFeatureFlagByKey(input.key);
  if (existing) throw new FeatureFlagKeyConflictError();

  const flag = await systemSettingsRepository.createFeatureFlag(input);
  await writeAuditLog({ actorId: adminUserId, action: "feature_flag_created", module: "SystemSettings", targetType: "FeatureFlag", targetId: flag.id });
  return flag;
}

export async function updateFeatureFlag(adminUserId: string, id: string, input: { enabled?: boolean; description?: string | null }) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  const flag = await systemSettingsRepository.updateFeatureFlag(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "feature_flag_updated", module: "SystemSettings", targetType: "FeatureFlag", targetId: id });
  return flag;
}

export async function deleteFeatureFlag(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  await systemSettingsRepository.deleteFeatureFlag(id);
  await writeAuditLog({ actorId: adminUserId, action: "feature_flag_deleted", module: "SystemSettings", targetType: "FeatureFlag", targetId: id });
}

/** No permission check — a real, generic helper any future code can call to check a flag, same "take effect without a deploy" the AC asks for, without inventing a fake consumer. Missing key = disabled, never an error. */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const flag = await systemSettingsRepository.findFeatureFlagByKey(key);
  return flag?.enabled ?? false;
}

// --- Inventory (Low Stock threshold) ---

export async function getLowStockThreshold(): Promise<number> {
  const setting = await systemSettingsRepository.getInventorySetting();
  return setting?.lowStockThreshold ?? 10;
}

export async function updateLowStockThreshold(adminUserId: string, lowStockThreshold: number) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  const updated = await systemSettingsRepository.updateInventorySetting(lowStockThreshold);
  await writeAuditLog({ actorId: adminUserId, action: "inventory_setting_updated", module: "SystemSettings", targetType: "InventorySetting", targetId: "global" });
  return updated;
}
