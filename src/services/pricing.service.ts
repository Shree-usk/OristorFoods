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

  if (campaigns.length > 0) return toResolvedPrice(campaigns[0], "campaign");
  if (sales.length > 0) return toResolvedPrice(sales[0], "sale");
  if (customerGroupPrice) return toResolvedPrice(customerGroupPrice, "customerGroup");

  if (volumeTiers.length > 0) {
    const bestTier = volumeTiers[0];
    return {
      price: computeVolumeDiscountPrice(bestTier, standard),
      currency: bestTier.currency,
      tier: "volumeDiscount",
      sourceId: bestTier.id,
    };
  }

  if (standard) return toResolvedPrice(standard, "standard");
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
    return standard.price.times(multiplier);
  }
  throw new Error(
    "VolumeDiscountTier has neither a discountPrice nor a standard price to apply discountPercent to",
  );
}
