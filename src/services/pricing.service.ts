import { Prisma, type CustomerGroup } from "@/generated/prisma/client";
import * as pricingRepository from "@/repositories/pricing.repository";

export interface ResolvePriceParams {
  productId: string;
  customerGroup?: CustomerGroup;
  quantity?: number;
  date?: Date;
}

export type PriceTier = "campaign" | "sale" | "customerGroup" | "volumeDiscount" | "standard";

export interface ResolvedPrice {
  price: Prisma.Decimal;
  currency: string;
  tier: PriceTier;
  sourceId: string;
}

interface PriceRow {
  id: string;
  price: Prisma.Decimal;
  currency: string;
}

/**
 * Resolves the price a customer pays for a product.
 *
 * Priority order (first match wins): campaign > sale > customer-group >
 * volume-discount > standard. Ties within a tier (e.g. two overlapping
 * SalePrice windows) are broken by most-recently-created row — the
 * repository layer's `getActive*` functions already return rows ordered
 * `createdAt desc`, so `[0]` is always the tie-break winner. Volume
 * discount tiers are the one exception: they're ordered by highest
 * `minQuantity` first (the deepest applicable discount), falling back to
 * most-recently-created only when two tiers share a `minQuantity`.
 *
 * Returns null if no tier applies at all (caller should treat this as
 * "no price configured for this product").
 */
export async function resolvePrice(params: ResolvePriceParams): Promise<ResolvedPrice | null> {
  const date = params.date ?? new Date();
  const quantity = params.quantity ?? 1;

  const [campaigns, sales, customerGroupPrice, volumeTiers, standard] = await Promise.all([
    pricingRepository.getActiveCampaignPrices(params.productId, date),
    pricingRepository.getActiveSalePrices(params.productId, date),
    params.customerGroup
      ? pricingRepository.getCustomerGroupPrice(params.productId, params.customerGroup)
      : Promise.resolve(null),
    pricingRepository.getApplicableVolumeDiscountTiers(params.productId, quantity),
    pricingRepository.getLatestStandardPrice(params.productId),
  ]);

  return resolveFromTierData({ campaigns, sales, customerGroupPrice, volumeTiers, standard });
}

/**
 * Bulk variant of `resolvePrice()` for product listings (STORY-010):
 * fetches all five tiers for every product in exactly 5 queries total
 * (never per-product — PGlite's single-connection limit makes N-per-product
 * fetches a real contention risk at listing scale), then applies the
 * identical priority/tie-break logic per product via `resolveFromTierData`.
 * Products with no price configured at all are simply absent from the
 * returned map.
 */
export async function resolvePricesForProducts(
  productIds: string[],
  params: { customerGroup?: CustomerGroup; quantity?: number; date?: Date } = {},
): Promise<Map<string, ResolvedPrice>> {
  const result = new Map<string, ResolvedPrice>();
  if (productIds.length === 0) return result;

  const date = params.date ?? new Date();
  const quantity = params.quantity ?? 1;

  const [campaigns, sales, customerGroupPrices, volumeTiers, standards] = await Promise.all([
    pricingRepository.getActiveCampaignPricesForProducts(productIds, date),
    pricingRepository.getActiveSalePricesForProducts(productIds, date),
    params.customerGroup
      ? pricingRepository.getCustomerGroupPricesForProducts(productIds, params.customerGroup)
      : Promise.resolve([]),
    pricingRepository.getApplicableVolumeDiscountTiersForProducts(productIds, quantity),
    pricingRepository.getLatestStandardPricesForProducts(productIds),
  ]);

  for (const productId of productIds) {
    const resolved = resolveFromTierData({
      campaigns: campaigns.filter((row) => row.productId === productId),
      sales: sales.filter((row) => row.productId === productId),
      customerGroupPrice: customerGroupPrices.find((row) => row.productId === productId) ?? null,
      volumeTiers: volumeTiers.filter((row) => row.productId === productId),
      standard: standards.find((row) => row.productId === productId) ?? null,
    });
    if (resolved) result.set(productId, resolved);
  }

  return result;
}

interface TierData {
  campaigns: PriceRow[];
  sales: PriceRow[];
  customerGroupPrice: PriceRow | null;
  volumeTiers: Array<{
    id: string;
    currency: string;
    discountPrice: Prisma.Decimal | null;
    discountPercent: Prisma.Decimal | null;
  }>;
  standard: PriceRow | null;
}

function resolveFromTierData(data: TierData): ResolvedPrice | null {
  if (data.campaigns.length > 0) return toResolvedPrice(data.campaigns[0], "campaign");
  if (data.sales.length > 0) return toResolvedPrice(data.sales[0], "sale");
  if (data.customerGroupPrice) return toResolvedPrice(data.customerGroupPrice, "customerGroup");

  if (data.volumeTiers.length > 0) {
    const bestTier = data.volumeTiers[0];
    return {
      price: computeVolumeDiscountPrice(bestTier, data.standard),
      currency: bestTier.currency,
      tier: "volumeDiscount",
      sourceId: bestTier.id,
    };
  }

  if (data.standard) return toResolvedPrice(data.standard, "standard");
  return null;
}

function toResolvedPrice(row: PriceRow, tier: PriceTier): ResolvedPrice {
  return { price: row.price, currency: row.currency, tier, sourceId: row.id };
}

function computeVolumeDiscountPrice(
  tier: { discountPrice: Prisma.Decimal | null; discountPercent: Prisma.Decimal | null },
  standard: PriceRow | null,
): Prisma.Decimal {
  if (tier.discountPrice) return tier.discountPrice;
  if (tier.discountPercent && standard) {
    const multiplier = new Prisma.Decimal(100).minus(tier.discountPercent).dividedBy(100);
    return standard.price.times(multiplier).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }
  throw new Error(
    "VolumeDiscountTier has neither a discountPrice nor a standard price to apply discountPercent to",
  );
}
