import * as shippingRepository from "@/repositories/shipping.repository";
import type { DeliveryResolution } from "@/types/checkout";
import { deliveryRateTiersSchema } from "@/validation/shipping.schema";

/**
 * Shipping/delivery-zone resolution (STORY-027 thin slice), per the
 * confirmed model in .claude/skills/delivery-zone-pricing/SKILL.md.
 * Precedence: campaign override → base zone rate → global free-shipping
 * threshold applied LAST (free shipping beats every rate and override).
 * Every unresolvable case fails safe with a typed non-"ok" status —
 * never a silent 0 charge.
 */

export function normalizeCity(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

interface ZoneCityList {
  name: string;
  cities: string[];
}

/**
 * All active zones matching the city, sorted by name — the caller uses
 * the first (deterministic alphabetical pick) and warns on ambiguity,
 * which is an admin misconfiguration that "should never happen".
 */
export function pickZonesForCity<T extends ZoneCityList>(zones: T[], city: string): T[] {
  const target = normalizeCity(city);
  return zones
    .filter((zone) => zone.cities.some((zoneCity) => normalizeCity(zoneCity) === target))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export interface ZoneForCalculation {
  zoneName: string;
  rate: {
    rateType: "Flat" | "WeightBased" | "ValueBased";
    flatAmount: string | null;
    tiers: unknown;
    estimatedDaysMin: number | null;
    estimatedDaysMax: number | null;
  } | null;
  override: {
    campaignName: string;
    freeShipping: boolean;
    overrideAmount: string | null;
  } | null;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

function parseAmount(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Charge from the zone's base rate, or null when configuration is unusable. */
function baseRateCharge(
  rate: NonNullable<ZoneForCalculation["rate"]>,
  subtotal: number,
  totalWeightGrams: number | null,
): number | { failSafe: "quote_required" | "config_error" } {
  if (rate.rateType === "Flat") {
    const amount = parseAmount(rate.flatAmount);
    return amount === null ? { failSafe: "config_error" } : amount;
  }

  const parsedTiers = deliveryRateTiersSchema.safeParse(rate.tiers);
  if (!parsedTiers.success) return { failSafe: "config_error" };
  const tiers = parsedTiers.data;

  if (rate.rateType === "WeightBased") {
    if (totalWeightGrams === null) return { failSafe: "quote_required" };
    const tier = tiers.find((t) => totalWeightGrams <= t.upTo) ?? tiers[tiers.length - 1];
    const amount = parseAmount(tier.amount);
    return amount === null ? { failSafe: "config_error" } : amount;
  }

  const tier = tiers.find((t) => subtotal <= t.upTo) ?? tiers[tiers.length - 1];
  const amount = parseAmount(tier.amount);
  return amount === null ? { failSafe: "config_error" } : amount;
}

export function calculateDeliveryCharge(input: {
  zone: ZoneForCalculation;
  subtotal: number;
  /** null = at least one cart line has an unknown product weight. */
  totalWeightGrams: number | null;
  freeShippingThreshold: number | null;
}): DeliveryResolution {
  const { zone, subtotal, totalWeightGrams, freeShippingThreshold } = input;

  let charge: number;
  let campaignApplied: string | null = null;

  if (zone.override) {
    if (zone.override.freeShipping) {
      charge = 0;
    } else {
      const amount = parseAmount(zone.override.overrideAmount);
      if (amount === null) return { status: "config_error" };
      charge = amount;
    }
    campaignApplied = zone.override.campaignName;
  } else {
    if (!zone.rate) return { status: "config_error" };
    const result = baseRateCharge(zone.rate, subtotal, totalWeightGrams);
    if (typeof result !== "number") return { status: result.failSafe };
    charge = result;
  }

  // Global threshold applied LAST — free shipping beats zone rates and
  // campaign overrides alike (confirmed business rule).
  const freeShippingApplied = freeShippingThreshold !== null && subtotal >= freeShippingThreshold;
  if (freeShippingApplied) charge = 0;

  const amountToFreeShipping =
    freeShippingThreshold !== null && !freeShippingApplied ? roundMoney(freeShippingThreshold - subtotal) : null;

  return {
    status: "ok",
    zoneName: zone.zoneName,
    charge: roundMoney(charge),
    currency: "LKR",
    freeShippingApplied,
    amountToFreeShipping,
    estimatedDaysMin: zone.rate?.estimatedDaysMin ?? null,
    estimatedDaysMax: zone.rate?.estimatedDaysMax ?? null,
    campaignApplied,
  };
}

/**
 * Resolves the delivery charge for a destination city against the live
 * zone configuration. `totalWeightGrams` is null when any cart line's
 * product has no weight — only weight-based zones care (fail-safe quote).
 */
export async function resolveDelivery(
  city: string,
  subtotal: number,
  totalWeightGrams: number | null,
): Promise<DeliveryResolution> {
  const zones = await shippingRepository.listActiveZonesWithRates(new Date());
  const matches = pickZonesForCity(zones, city);
  if (matches.length === 0) return { status: "no_zone" };
  if (matches.length > 1) {
    console.warn(
      `[shipping] city "${city}" matches ${matches.length} active zones (${matches.map((z) => z.name).join(", ")}) — using "${matches[0].name}". Fix the zone configuration.`,
    );
  }

  const zone = matches[0];
  const freeShippingThreshold = await shippingRepository.getFreeShippingThreshold();

  return calculateDeliveryCharge({
    zone: {
      zoneName: zone.name,
      rate: zone.rate
        ? {
            rateType: zone.rate.rateType,
            flatAmount: zone.rate.flatAmount?.toFixed(2) ?? null,
            tiers: zone.rate.tiers,
            estimatedDaysMin: zone.rate.estimatedDaysMin,
            estimatedDaysMax: zone.rate.estimatedDaysMax,
          }
        : null,
      override: zone.overrides[0]
        ? {
            campaignName: zone.overrides[0].campaignName,
            freeShipping: zone.overrides[0].freeShipping,
            overrideAmount: zone.overrides[0].overrideAmount?.toFixed(2) ?? null,
          }
        : null,
    },
    subtotal,
    totalWeightGrams,
    freeShippingThreshold,
  });
}
