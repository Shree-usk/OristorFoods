/** STORY-054. Fetch wrappers for /api/admin/settings/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface CompanySetting {
  id: string;
  legalName: string | null;
  brandName: string | null;
  logoUrl: string | null;
  logoAlt: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  businessRegistrationId: string | null;
  taxId: string | null;
  socialLinks: { label: string; href: string }[] | null;
  contactHeroEyebrow: string | null;
  contactHeroHeadline: string | null;
  contactHeroSubcopy: string | null;
  contactLocationHeading: string | null;
}

export type CompanySettingInput = Partial<Omit<CompanySetting, "id">>;

export async function fetchCompanySetting(): Promise<CompanySetting | null> {
  const response = await fetch("/api/admin/settings/company");
  if (!response.ok) throw new Error(`Failed to load company settings (${response.status})`);
  return response.json();
}

export async function updateCompanySetting(input: CompanySettingInput): Promise<CompanySetting> {
  const response = await fetch("/api/admin/settings/company", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save company settings");
  return response.json();
}

export interface CurrencySetting {
  id: string;
  baseCurrency: string;
  supportedCurrencies: string[];
  manualExchangeRates: Record<string, number> | null;
}

export async function fetchCurrencySetting(): Promise<CurrencySetting | null> {
  const response = await fetch("/api/admin/settings/currencies");
  if (!response.ok) throw new Error(`Failed to load currency settings (${response.status})`);
  return response.json();
}

export async function updateCurrencySetting(input: Partial<Omit<CurrencySetting, "id">>): Promise<CurrencySetting> {
  const response = await fetch("/api/admin/settings/currencies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save currency settings");
  return response.json();
}

export interface LocaleSetting {
  id: string;
  defaultLocale: string;
  supportedLocales: string[];
}

export async function fetchLocaleSetting(): Promise<LocaleSetting | null> {
  const response = await fetch("/api/admin/settings/locales");
  if (!response.ok) throw new Error(`Failed to load locale settings (${response.status})`);
  return response.json();
}

export async function updateLocaleSetting(input: Partial<Omit<LocaleSetting, "id">>): Promise<LocaleSetting> {
  const response = await fetch("/api/admin/settings/locales", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save locale settings");
  return response.json();
}

export type TaxPricingDisplayModeValue = "Inclusive" | "Exclusive";

export interface TaxRateRule {
  id: string;
  region: string;
  category: string | null;
  ratePercent: string;
  isActive: boolean;
}

export interface TaxSettings {
  setting: { id: string; pricingDisplayMode: TaxPricingDisplayModeValue } | null;
  rules: TaxRateRule[];
}

export async function fetchTaxSettings(): Promise<TaxSettings> {
  const response = await fetch("/api/admin/settings/taxes");
  if (!response.ok) throw new Error(`Failed to load tax settings (${response.status})`);
  return response.json();
}

export async function updateTaxDisplayMode(pricingDisplayMode: TaxPricingDisplayModeValue) {
  const response = await fetch("/api/admin/settings/taxes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pricingDisplayMode }) });
  await assertOkWithServerMessage(response, "Failed to save the tax display mode");
  return response.json();
}

export interface TaxRateRuleInput {
  region: string;
  category: string | null;
  ratePercent: number;
  isActive: boolean;
}

export async function createTaxRateRule(input: TaxRateRuleInput): Promise<TaxRateRule> {
  const response = await fetch("/api/admin/settings/tax-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to add the tax rule");
  return response.json();
}

export async function updateTaxRateRule(id: string, input: Partial<TaxRateRuleInput>): Promise<TaxRateRule> {
  const response = await fetch(`/api/admin/settings/tax-rules/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the tax rule");
  return response.json();
}

export async function deleteTaxRateRule(id: string): Promise<void> {
  const response = await fetch(`/api/admin/settings/tax-rules/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to remove the tax rule");
}

export async function fetchFreeShippingThreshold(): Promise<number | null> {
  const response = await fetch("/api/admin/settings/shipping");
  if (!response.ok) throw new Error(`Failed to load the shipping threshold (${response.status})`);
  const data = await response.json();
  return data.freeShippingThreshold;
}

export async function updateFreeShippingThreshold(value: number): Promise<number> {
  const response = await fetch("/api/admin/settings/shipping", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
  await assertOkWithServerMessage(response, "Failed to save the free-shipping threshold");
  const data = await response.json();
  return data.freeShippingThreshold;
}

export async function fetchLowStockThreshold(): Promise<number> {
  const response = await fetch("/api/admin/settings/inventory");
  if (!response.ok) throw new Error(`Failed to load the low-stock threshold (${response.status})`);
  const data = await response.json();
  return data.lowStockThreshold;
}

export async function updateLowStockThreshold(lowStockThreshold: number): Promise<{ lowStockThreshold: number }> {
  const response = await fetch("/api/admin/settings/inventory", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lowStockThreshold }) });
  await assertOkWithServerMessage(response, "Failed to save the low-stock threshold");
  return response.json();
}

export interface PaymentMethodSetting {
  id: string;
  key: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
}

export async function fetchPaymentMethods(): Promise<PaymentMethodSetting[]> {
  const response = await fetch("/api/admin/settings/payment-methods");
  if (!response.ok) throw new Error(`Failed to load payment methods (${response.status})`);
  return response.json();
}

export async function createPaymentMethod(input: { key: string; label: string; enabled: boolean }): Promise<PaymentMethodSetting> {
  const response = await fetch("/api/admin/settings/payment-methods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to add the payment method");
  return response.json();
}

export async function updatePaymentMethod(id: string, input: { label?: string; enabled?: boolean }): Promise<PaymentMethodSetting> {
  const response = await fetch(`/api/admin/settings/payment-methods/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the payment method");
  return response.json();
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const response = await fetch(`/api/admin/settings/payment-methods/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to remove the payment method");
}

export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
}

export async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  const response = await fetch("/api/admin/settings/feature-flags");
  if (!response.ok) throw new Error(`Failed to load feature flags (${response.status})`);
  return response.json();
}

export async function createFeatureFlag(input: { key: string; enabled: boolean; description: string | null }): Promise<FeatureFlag> {
  const response = await fetch("/api/admin/settings/feature-flags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to add the feature flag");
  return response.json();
}

export async function updateFeatureFlag(id: string, input: { enabled?: boolean; description?: string | null }): Promise<FeatureFlag> {
  const response = await fetch(`/api/admin/settings/feature-flags/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the feature flag");
  return response.json();
}

export async function deleteFeatureFlag(id: string): Promise<void> {
  const response = await fetch(`/api/admin/settings/feature-flags/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to remove the feature flag");
}

export type NotificationChannelValue = "Email" | "SMS" | "WhatsApp";

export interface NotificationTemplate {
  id: string;
  templateKey: string;
  channel: NotificationChannelValue;
  subject: string | null;
  body: string;
  isActive: boolean;
}

export async function fetchNotificationTemplates(): Promise<NotificationTemplate[]> {
  const response = await fetch("/api/admin/settings/notification-templates");
  if (!response.ok) throw new Error(`Failed to load notification templates (${response.status})`);
  return response.json();
}

export async function updateNotificationTemplate(id: string, input: { subject?: string | null; body?: string; isActive?: boolean }): Promise<NotificationTemplate> {
  const response = await fetch(`/api/admin/settings/notification-templates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save the notification template");
  return response.json();
}

export async function previewNotificationTemplate(body: string, sampleVariables: Record<string, string>): Promise<string> {
  const response = await fetch("/api/admin/settings/notification-templates/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, sampleVariables }) });
  await assertOkWithServerMessage(response, "Failed to render the preview");
  const data = await response.json();
  return data.rendered;
}
