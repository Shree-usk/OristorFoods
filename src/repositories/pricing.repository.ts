import { prisma } from "@/lib/db";
import type { CustomerGroup, Prisma } from "@/generated/prisma/client";

export function createStandardPrice(data: Prisma.StandardPriceCreateInput) {
  return prisma.standardPrice.create({ data });
}

export function createSalePrice(data: Prisma.SalePriceCreateInput) {
  return prisma.salePrice.create({ data });
}

export function createCampaignPrice(data: Prisma.CampaignPriceCreateInput) {
  return prisma.campaignPrice.create({ data });
}

export function createCustomerGroupPrice(data: Prisma.CustomerGroupPriceCreateInput) {
  return prisma.customerGroupPrice.create({ data });
}

export function createVolumeDiscountTier(data: Prisma.VolumeDiscountTierCreateInput) {
  return prisma.volumeDiscountTier.create({ data });
}

export function getLatestStandardPrice(productId: string) {
  return prisma.standardPrice.findFirst({
    where: { productId },
    orderBy: { createdAt: "desc" },
  });
}

export function getActiveSalePrices(productId: string, date: Date) {
  return prisma.salePrice.findMany({
    where: { productId, startDate: { lte: date }, endDate: { gte: date } },
    orderBy: { createdAt: "desc" },
  });
}

export function getActiveCampaignPrices(productId: string, date: Date) {
  return prisma.campaignPrice.findMany({
    where: { productId, startDate: { lte: date }, endDate: { gte: date } },
    orderBy: { createdAt: "desc" },
  });
}

export function getCustomerGroupPrice(productId: string, customerGroup: CustomerGroup) {
  return prisma.customerGroupPrice.findFirst({
    where: { productId, customerGroup },
    orderBy: { createdAt: "desc" },
  });
}

export function getApplicableVolumeDiscountTiers(productId: string, quantity: number) {
  return prisma.volumeDiscountTier.findMany({
    where: { productId, minQuantity: { lte: quantity } },
    orderBy: [{ minQuantity: "desc" }, { createdAt: "desc" }],
  });
}

export function getLatestStandardPricesForProducts(productIds: string[]) {
  return prisma.standardPrice.findMany({
    where: { productId: { in: productIds } },
    orderBy: { createdAt: "desc" },
  });
}

export function getActiveSalePricesForProducts(productIds: string[], date: Date) {
  return prisma.salePrice.findMany({
    where: { productId: { in: productIds }, startDate: { lte: date }, endDate: { gte: date } },
    orderBy: { createdAt: "desc" },
  });
}

export function getActiveCampaignPricesForProducts(productIds: string[], date: Date) {
  return prisma.campaignPrice.findMany({
    where: { productId: { in: productIds }, startDate: { lte: date }, endDate: { gte: date } },
    orderBy: { createdAt: "desc" },
  });
}

export function getCustomerGroupPricesForProducts(productIds: string[], customerGroup: CustomerGroup) {
  return prisma.customerGroupPrice.findMany({
    where: { productId: { in: productIds }, customerGroup },
    orderBy: { createdAt: "desc" },
  });
}

export function getApplicableVolumeDiscountTiersForProducts(productIds: string[], quantity: number) {
  return prisma.volumeDiscountTier.findMany({
    where: { productId: { in: productIds }, minQuantity: { lte: quantity } },
    orderBy: [{ minQuantity: "desc" }, { createdAt: "desc" }],
  });
}
