import { describe, expect, it } from "vitest";

import {
  calculateDeliveryCharge,
  normalizeCity,
  pickZonesForCity,
  type ZoneForCalculation,
} from "@/services/shipping.service";

function flatZone(overrides: Partial<ZoneForCalculation> = {}): ZoneForCalculation {
  return {
    zoneName: "Colombo",
    rate: {
      rateType: "Flat",
      flatAmount: "350.00",
      tiers: null,
      estimatedDaysMin: 1,
      estimatedDaysMax: 2,
    },
    override: null,
    ...overrides,
  };
}

describe("normalizeCity", () => {
  it("trims, collapses internal whitespace, and lowercases", () => {
    expect(normalizeCity("  Colombo  ")).toBe("colombo");
    expect(normalizeCity("Nuwara   Eliya")).toBe("nuwara eliya");
    expect(normalizeCity("KANDY")).toBe("kandy");
  });
});

describe("pickZonesForCity", () => {
  const zones = [
    { name: "Hill Country", cities: ["Kandy", "Nuwara Eliya"] },
    { name: "Western", cities: ["Colombo", "Negombo"] },
    { name: "Also Western", cities: ["colombo"] },
  ];

  it("matches case- and whitespace-insensitively", () => {
    expect(pickZonesForCity(zones, "  kAnDy ").map((z) => z.name)).toEqual(["Hill Country"]);
  });

  it("returns no zones for an unknown city", () => {
    expect(pickZonesForCity(zones, "Jaffna")).toEqual([]);
  });

  it("returns ambiguous matches sorted by zone name for deterministic selection", () => {
    expect(pickZonesForCity(zones, "Colombo").map((z) => z.name)).toEqual(["Also Western", "Western"]);
  });
});

describe("calculateDeliveryCharge", () => {
  it("charges a flat-rate zone its flat amount", () => {
    const result = calculateDeliveryCharge({ zone: flatZone(), subtotal: 2000, totalWeightGrams: 500, freeShippingThreshold: null });
    expect(result).toMatchObject({ status: "ok", zoneName: "Colombo", charge: 350, freeShippingApplied: false, campaignApplied: null });
  });

  it("selects the first weight tier the cart weight fits into", () => {
    const zone = flatZone({
      rate: {
        rateType: "WeightBased",
        flatAmount: null,
        tiers: [
          { upTo: 1000, amount: "300.00" },
          { upTo: 5000, amount: "550.00" },
        ],
        estimatedDaysMin: null,
        estimatedDaysMax: null,
      },
    });
    expect(calculateDeliveryCharge({ zone, subtotal: 2000, totalWeightGrams: 999, freeShippingThreshold: null })).toMatchObject({ status: "ok", charge: 300 });
    expect(calculateDeliveryCharge({ zone, subtotal: 2000, totalWeightGrams: 1000, freeShippingThreshold: null })).toMatchObject({ status: "ok", charge: 300 });
    expect(calculateDeliveryCharge({ zone, subtotal: 2000, totalWeightGrams: 1001, freeShippingThreshold: null })).toMatchObject({ status: "ok", charge: 550 });
  });

  it("charges the last weight tier's amount when heavier than every tier", () => {
    const zone = flatZone({
      rate: { rateType: "WeightBased", flatAmount: null, tiers: [{ upTo: 1000, amount: "300.00" }], estimatedDaysMin: null, estimatedDaysMax: null },
    });
    expect(calculateDeliveryCharge({ zone, subtotal: 2000, totalWeightGrams: 99999, freeShippingThreshold: null })).toMatchObject({ status: "ok", charge: 300 });
  });

  it("fails safe with quote_required when a weight-based zone gets an unknown cart weight", () => {
    const zone = flatZone({
      rate: { rateType: "WeightBased", flatAmount: null, tiers: [{ upTo: 1000, amount: "300.00" }], estimatedDaysMin: null, estimatedDaysMax: null },
    });
    expect(calculateDeliveryCharge({ zone, subtotal: 2000, totalWeightGrams: null, freeShippingThreshold: null })).toEqual({ status: "quote_required" });
  });

  it("selects value tiers by subtotal", () => {
    const zone = flatZone({
      rate: {
        rateType: "ValueBased",
        flatAmount: null,
        tiers: [
          { upTo: 2500, amount: "450.00" },
          { upTo: 10000, amount: "250.00" },
        ],
        estimatedDaysMin: null,
        estimatedDaysMax: null,
      },
    });
    expect(calculateDeliveryCharge({ zone, subtotal: 2500, totalWeightGrams: null, freeShippingThreshold: null })).toMatchObject({ status: "ok", charge: 450 });
    expect(calculateDeliveryCharge({ zone, subtotal: 2501, totalWeightGrams: null, freeShippingThreshold: null })).toMatchObject({ status: "ok", charge: 250 });
    expect(calculateDeliveryCharge({ zone, subtotal: 999999, totalWeightGrams: null, freeShippingThreshold: null })).toMatchObject({ status: "ok", charge: 250 });
  });

  it("lets an active campaign override beat the base rate", () => {
    const zone = flatZone({ override: { campaignName: "Avurudu Free Delivery", freeShipping: true, overrideAmount: null } });
    expect(calculateDeliveryCharge({ zone, subtotal: 1000, totalWeightGrams: 500, freeShippingThreshold: null })).toMatchObject({
      status: "ok",
      charge: 0,
      campaignApplied: "Avurudu Free Delivery",
    });

    const discounted = flatZone({ override: { campaignName: "Monsoon Deal", freeShipping: false, overrideAmount: "99.00" } });
    expect(calculateDeliveryCharge({ zone: discounted, subtotal: 1000, totalWeightGrams: 500, freeShippingThreshold: null })).toMatchObject({
      status: "ok",
      charge: 99,
      campaignApplied: "Monsoon Deal",
    });
  });

  it("applies the global free-shipping threshold last, beating zone rates and overrides", () => {
    expect(calculateDeliveryCharge({ zone: flatZone(), subtotal: 7500, totalWeightGrams: 500, freeShippingThreshold: 7500 })).toMatchObject({
      status: "ok",
      charge: 0,
      freeShippingApplied: true,
      amountToFreeShipping: null,
    });

    const withOverride = flatZone({ override: { campaignName: "Monsoon Deal", freeShipping: false, overrideAmount: "99.00" } });
    expect(calculateDeliveryCharge({ zone: withOverride, subtotal: 8000, totalWeightGrams: 500, freeShippingThreshold: 7500 })).toMatchObject({
      status: "ok",
      charge: 0,
      freeShippingApplied: true,
    });
  });

  it("reports the amount still needed to reach free shipping when below the threshold", () => {
    const result = calculateDeliveryCharge({ zone: flatZone(), subtotal: 7499.5, totalWeightGrams: 500, freeShippingThreshold: 7500 });
    expect(result).toMatchObject({ status: "ok", charge: 350, freeShippingApplied: false, amountToFreeShipping: 0.5 });
  });

  it("fails safe with config_error on malformed configuration", () => {
    const noRate = flatZone({ rate: null });
    expect(calculateDeliveryCharge({ zone: noRate, subtotal: 1000, totalWeightGrams: 500, freeShippingThreshold: null })).toEqual({ status: "config_error" });

    const missingFlat = flatZone({ rate: { rateType: "Flat", flatAmount: null, tiers: null, estimatedDaysMin: null, estimatedDaysMax: null } });
    expect(calculateDeliveryCharge({ zone: missingFlat, subtotal: 1000, totalWeightGrams: 500, freeShippingThreshold: null })).toEqual({ status: "config_error" });

    const badTiers = flatZone({
      rate: { rateType: "ValueBased", flatAmount: null, tiers: [{ upTo: -5, amount: "nope" }], estimatedDaysMin: null, estimatedDaysMax: null },
    });
    expect(calculateDeliveryCharge({ zone: badTiers, subtotal: 1000, totalWeightGrams: 500, freeShippingThreshold: null })).toEqual({ status: "config_error" });

    const badOverride = flatZone({ override: { campaignName: "Broken", freeShipping: false, overrideAmount: null } });
    expect(calculateDeliveryCharge({ zone: badOverride, subtotal: 1000, totalWeightGrams: 500, freeShippingThreshold: null })).toEqual({ status: "config_error" });
  });
});
