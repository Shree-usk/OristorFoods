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

// --- Admin CRUD (STORY-040) ---
// StandardPrice/SalePrice/CampaignPrice are an append-only ledger (a new
// row per price change, "latest"/"active" wins on read) — see this file's
// own getLatest*/getActive* functions above. product-admin.service.ts's
// "set standard price" therefore always calls createStandardPrice (never an
// update). SalePrice/CampaignPrice windows and VolumeDiscountTier rungs are
// each a distinct row the admin can edit/delete individually, so those get
// real update/delete functions. CustomerGroupPrice is upserted in place
// (its own @@unique([productId, customerGroup]) makes a second row for the
// same group impossible).

export function listStandardPriceHistory(productId: string) {
  return prisma.standardPrice.findMany({ where: { productId }, orderBy: { createdAt: "desc" } });
}

export function listSalePrices(productId: string) {
  return prisma.salePrice.findMany({ where: { productId }, orderBy: { startDate: "desc" } });
}

export function updateSalePrice(id: string, data: Prisma.SalePriceUpdateInput) {
  return prisma.salePrice.update({ where: { id }, data });
}

export function deleteSalePrice(id: string) {
  return prisma.salePrice.delete({ where: { id } });
}

export function listCampaignPrices(productId: string) {
  return prisma.campaignPrice.findMany({ where: { productId }, orderBy: { startDate: "desc" } });
}

export function updateCampaignPrice(id: string, data: Prisma.CampaignPriceUpdateInput) {
  return prisma.campaignPrice.update({ where: { id }, data });
}

export function deleteCampaignPrice(id: string) {
  return prisma.campaignPrice.delete({ where: { id } });
}

export function listCustomerGroupPrices(productId: string) {
  return prisma.customerGroupPrice.findMany({ where: { productId } });
}

export function upsertCustomerGroupPrice(productId: string, customerGroup: CustomerGroup, price: number | string, currency: string) {
  return prisma.customerGroupPrice.upsert({
    where: { productId_customerGroup: { productId, customerGroup } },
    create: { productId, customerGroup, price, currency },
    update: { price, currency },
  });
}

export function deleteCustomerGroupPrice(productId: string, customerGroup: CustomerGroup) {
  return prisma.customerGroupPrice.delete({ where: { productId_customerGroup: { productId, customerGroup } } });
}

export function listVolumeDiscountTiers(productId: string) {
  return prisma.volumeDiscountTier.findMany({ where: { productId }, orderBy: { minQuantity: "asc" } });
}

export function updateVolumeDiscountTier(id: string, data: Prisma.VolumeDiscountTierUpdateInput) {
  return prisma.volumeDiscountTier.update({ where: { id }, data });
}

export function deleteVolumeDiscountTier(id: string) {
  return prisma.volumeDiscountTier.delete({ where: { id } });
}
