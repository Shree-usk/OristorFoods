import { z } from "zod";

/** An empty string from a cleared form field means "unset" — stored as SQL NULL, not "". */
const emptyToNull = (value: unknown) => (value === "" ? null : value);

export const companySettingSchema = z.object({
  legalName: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  brandName: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  logoUrl: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  logoAlt: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  address: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  phone: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  email: z.preprocess(emptyToNull, z.string().trim().email("Enter a valid email.").nullable().optional()),
  businessRegistrationId: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  taxId: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  socialLinks: z
    .array(z.object({ label: z.string().trim().min(1), href: z.string().trim().url("Enter a valid URL.") }))
    .nullable()
    .optional(),
  contactHeroEyebrow: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  contactHeroHeadline: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  contactHeroSubcopy: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  contactLocationHeading: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
});

export const currencySettingSchema = z.object({
  baseCurrency: z.string().trim().length(3, "Use a 3-letter currency code.").optional(),
  supportedCurrencies: z.array(z.string().trim().length(3)).min(1).optional(),
  manualExchangeRates: z.record(z.string().trim().length(3), z.number().positive()).nullable().optional(),
});

export const localeSettingSchema = z.object({
  defaultLocale: z.string().trim().min(2).optional(),
  supportedLocales: z.array(z.string().trim().min(2)).min(1).optional(),
});

export const taxDisplayModeSchema = z.object({
  pricingDisplayMode: z.enum(["Inclusive", "Exclusive"]),
});

export const taxRateRuleSchema = z.object({
  region: z.string().trim().min(1, "Region is required."),
  category: z.string().trim().min(1).nullable().optional(),
  ratePercent: z.number().min(0).max(100),
  isActive: z.boolean().default(true),
});

export const updateTaxRateRuleSchema = taxRateRuleSchema.partial();

export const freeShippingThresholdSchema = z.object({
  value: z.number().min(0),
});

export const createPaymentMethodSchema = z.object({
  key: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(100),
  enabled: z.boolean().default(true),
});

export const updatePaymentMethodSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
});

export const createFeatureFlagSchema = z.object({
  key: z.string().trim().min(1).max(60),
  enabled: z.boolean().default(false),
  description: z.string().trim().max(500).nullable().optional(),
});

export const updateFeatureFlagSchema = z.object({
  enabled: z.boolean().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export const lowStockThresholdSchema = z.object({
  lowStockThreshold: z.number().int().min(0),
});

export const updateNotificationTemplateSchema = z.object({
  subject: z.string().trim().min(1).nullable().optional(),
  body: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const previewTemplateSchema = z.object({
  body: z.string(),
  sampleVariables: z.record(z.string(), z.string()).optional(),
});
