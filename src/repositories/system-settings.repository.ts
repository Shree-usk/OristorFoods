import type { Prisma, TaxPricingDisplayMode } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-054. The only place CompanySetting/CurrencySetting/LocaleSetting/TaxSetting/TaxRateRule/PaymentMethodSetting/FeatureFlag/InventorySetting are queried/mutated. Singleton rows upserted by id: "global" — same pattern as ShippingSetting/RewardSetting. */

export function getCompanySetting() {
  return prisma.companySetting.findUnique({ where: { id: "global" } });
}

export function updateCompanySetting(input: Prisma.CompanySettingUncheckedCreateInput) {
  return prisma.companySetting.upsert({ where: { id: "global" }, create: { id: "global", ...input }, update: input });
}

export function getCurrencySetting() {
  return prisma.currencySetting.findUnique({ where: { id: "global" } });
}

export function updateCurrencySetting(input: Prisma.CurrencySettingUncheckedCreateInput) {
  return prisma.currencySetting.upsert({ where: { id: "global" }, create: { id: "global", ...input }, update: input });
}

export function getLocaleSetting() {
  return prisma.localeSetting.findUnique({ where: { id: "global" } });
}

export function updateLocaleSetting(input: Prisma.LocaleSettingUncheckedCreateInput) {
  return prisma.localeSetting.upsert({ where: { id: "global" }, create: { id: "global", ...input }, update: input });
}

export function getTaxSetting() {
  return prisma.taxSetting.findUnique({ where: { id: "global" } });
}

export function updateTaxSetting(pricingDisplayMode: TaxPricingDisplayMode) {
  return prisma.taxSetting.upsert({ where: { id: "global" }, create: { id: "global", pricingDisplayMode }, update: { pricingDisplayMode } });
}

export function listTaxRateRules() {
  return prisma.taxRateRule.findMany({ orderBy: [{ region: "asc" }, { category: "asc" }] });
}

export function createTaxRateRule(data: { region: string; category: string | null; ratePercent: string; isActive: boolean }) {
  return prisma.taxRateRule.create({ data });
}

export function updateTaxRateRule(id: string, data: { region?: string; category?: string | null; ratePercent?: string; isActive?: boolean }) {
  return prisma.taxRateRule.update({ where: { id }, data });
}

export function deleteTaxRateRule(id: string) {
  return prisma.taxRateRule.delete({ where: { id } });
}

export function listPaymentMethods() {
  return prisma.paymentMethodSetting.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function nextPaymentMethodSortOrder(): Promise<number> {
  const last = await prisma.paymentMethodSetting.findFirst({ orderBy: { sortOrder: "desc" } });
  return (last?.sortOrder ?? -1) + 1;
}

export function createPaymentMethod(data: { key: string; label: string; enabled: boolean; sortOrder: number }) {
  return prisma.paymentMethodSetting.create({ data });
}

export function updatePaymentMethod(id: string, data: { label?: string; enabled?: boolean; sortOrder?: number }) {
  return prisma.paymentMethodSetting.update({ where: { id }, data });
}

export function deletePaymentMethod(id: string) {
  return prisma.paymentMethodSetting.delete({ where: { id } });
}

export function listFeatureFlags() {
  return prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
}

export function findFeatureFlagByKey(key: string) {
  return prisma.featureFlag.findUnique({ where: { key } });
}

export function createFeatureFlag(data: { key: string; enabled: boolean; description: string | null }) {
  return prisma.featureFlag.create({ data });
}

export function updateFeatureFlag(id: string, data: { enabled?: boolean; description?: string | null }) {
  return prisma.featureFlag.update({ where: { id }, data });
}

export function deleteFeatureFlag(id: string) {
  return prisma.featureFlag.delete({ where: { id } });
}

export function getInventorySetting() {
  return prisma.inventorySetting.findUnique({ where: { id: "global" } });
}

export function updateInventorySetting(lowStockThreshold: number) {
  return prisma.inventorySetting.upsert({ where: { id: "global" }, create: { id: "global", lowStockThreshold }, update: { lowStockThreshold } });
}
