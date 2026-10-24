import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  allocateGroupCharge,
  calculatePerGramCharge,
  isAvailabilityCompatible,
  packagingSelectionValidity,
  packagingWeightGroupValidity,
  type PackagingOptionForValidity,
} from "@/services/packaging.service";

const NOW = new Date("2026-06-01T00:00:00Z");

function baseOption(overrides: Partial<PackagingOptionForValidity> = {}): PackagingOptionForValidity {
  return {
    status: "Active",
    availabilityStartDate: null,
    availabilityEndDate: null,
    orderCutoffDate: null,
    minQuantity: null,
    availability: "Both",
    packagingMethod: { status: "Active" },
    ...overrides,
  };
}

describe("isAvailabilityCompatible", () => {
  it("accepts either declaration for Both", () => {
    expect(isAvailabilityCompatible("Both", "Local")).toBe(true);
    expect(isAvailabilityCompatible("Both", "Export")).toBe(true);
  });

  it("requires an exact match for Local/Export", () => {
    expect(isAvailabilityCompatible("Local", "Local")).toBe(true);
    expect(isAvailabilityCompatible("Local", "Export")).toBe(false);
    expect(isAvailabilityCompatible("Export", "Export")).toBe(true);
    expect(isAvailabilityCompatible("Export", "Local")).toBe(false);
  });
});

describe("packagingSelectionValidity", () => {
  it("accepts a plain Active option with no constraints", () => {
    expect(packagingSelectionValidity(baseOption(), 1, "Local", NOW)).toEqual({ valid: true });
  });

  it("rejects a TemporarilyUnavailable/Discontinued option as unavailable", () => {
    expect(packagingSelectionValidity(baseOption({ status: "TemporarilyUnavailable" }), 1, "Local", NOW)).toEqual({ valid: false, reason: "unavailable" });
    expect(packagingSelectionValidity(baseOption({ status: "Discontinued" }), 1, "Local", NOW)).toEqual({ valid: false, reason: "unavailable" });
  });

  it("rejects when the parent packaging method is inactive", () => {
    expect(packagingSelectionValidity(baseOption({ packagingMethod: { status: "Inactive" } }), 1, "Local", NOW)).toEqual({ valid: false, reason: "unavailable" });
  });

  it("rejects before the availability start date", () => {
    const option = baseOption({ availabilityStartDate: new Date("2026-07-01T00:00:00Z") });
    expect(packagingSelectionValidity(option, 1, "Local", NOW)).toEqual({ valid: false, reason: "unavailable" });
  });

  it("rejects after the availability end date", () => {
    const option = baseOption({ availabilityEndDate: new Date("2026-05-01T00:00:00Z") });
    expect(packagingSelectionValidity(option, 1, "Local", NOW)).toEqual({ valid: false, reason: "unavailable" });
  });

  it("rejects past the order cutoff date", () => {
    const option = baseOption({ orderCutoffDate: new Date("2026-05-01T00:00:00Z") });
    expect(packagingSelectionValidity(option, 1, "Local", NOW)).toEqual({ valid: false, reason: "unavailable" });
  });

  it("accepts within an open availability window and before cutoff", () => {
    const option = baseOption({
      availabilityStartDate: new Date("2026-01-01T00:00:00Z"),
      availabilityEndDate: new Date("2026-12-31T00:00:00Z"),
      orderCutoffDate: new Date("2026-12-01T00:00:00Z"),
    });
    expect(packagingSelectionValidity(option, 1, "Local", NOW)).toEqual({ valid: true });
  });

  it("rejects an Export-only option declared Local", () => {
    const option = baseOption({ availability: "Export" });
    expect(packagingSelectionValidity(option, 1, "Local", NOW)).toEqual({ valid: false, reason: "availability_mismatch" });
  });

  it("rejects a Local-only option declared Export", () => {
    const option = baseOption({ availability: "Local" });
    expect(packagingSelectionValidity(option, 1, "Export", NOW)).toEqual({ valid: false, reason: "availability_mismatch" });
  });

  it("rejects quantity below the minimum", () => {
    const option = baseOption({ minQuantity: 2 });
    expect(packagingSelectionValidity(option, 1, "Local", NOW)).toEqual({ valid: false, reason: "minimum_quantity" });
  });

  it("accepts quantity at or above the minimum", () => {
    const option = baseOption({ minQuantity: 2 });
    expect(packagingSelectionValidity(option, 2, "Local", NOW)).toEqual({ valid: true });
    expect(packagingSelectionValidity(option, 3, "Local", NOW)).toEqual({ valid: true });
  });

  it("checks status/window/cutoff before availability or minimum quantity", () => {
    // An option that fails on BOTH an unavailable status and a mismatched
    // availability reports "unavailable" — status is the earliest gate.
    const option = baseOption({ status: "Discontinued", availability: "Export", minQuantity: 5 });
    expect(packagingSelectionValidity(option, 1, "Local", NOW)).toEqual({ valid: false, reason: "unavailable" });
  });
});

// Story 3b — weight-based ("per-gram") packaging pricing.

describe("packagingWeightGroupValidity", () => {
  it("accepts when there is no configured minimum", () => {
    expect(packagingWeightGroupValidity(1, null)).toEqual({ valid: true });
  });

  it("rejects a group weight below the configured minimum", () => {
    expect(packagingWeightGroupValidity(500, 1000)).toEqual({ valid: false, reason: "minimum_weight" });
  });

  it("accepts a group weight at or above the configured minimum", () => {
    expect(packagingWeightGroupValidity(1000, 1000)).toEqual({ valid: true });
    expect(packagingWeightGroupValidity(1500, 1000)).toEqual({ valid: true });
  });
});

describe("calculatePerGramCharge", () => {
  it("multiplies weight by rate, rounded to currency precision", () => {
    // The doc's own worked example: 750g at LKR 0.50/g = LKR 375.
    const result = calculatePerGramCharge(750, new Prisma.Decimal("0.50"), null);
    expect(result.rawCharge.toFixed(2)).toBe("375.00");
    expect(result.finalCharge.toFixed(2)).toBe("375.00");
    expect(result.minimumChargeApplied).toBe(false);
  });

  it("floors the charge at the configured minimum packaging charge", () => {
    const result = calculatePerGramCharge(100, new Prisma.Decimal("0.50"), new Prisma.Decimal("100.00"));
    expect(result.rawCharge.toFixed(2)).toBe("50.00");
    expect(result.finalCharge.toFixed(2)).toBe("100.00");
    expect(result.minimumChargeApplied).toBe(true);
  });

  it("never applies a minimum that's already cleared", () => {
    const result = calculatePerGramCharge(1000, new Prisma.Decimal("0.50"), new Prisma.Decimal("100.00"));
    expect(result.finalCharge.toFixed(2)).toBe("500.00");
    expect(result.minimumChargeApplied).toBe(false);
  });
});

describe("allocateGroupCharge", () => {
  it("splits a group's charge across members proportional to weight, summing to exactly the final charge", () => {
    // Doc's example: two 200g units + one 350g unit = 750g @ LKR 0.50/g = LKR 375.
    const members = [
      { itemId: "item-a", weightGrams: 400 }, // two 200g units
      { itemId: "item-b", weightGrams: 350 }, // one 350g unit
    ];
    const shares = allocateGroupCharge(members, new Prisma.Decimal("375.00"), 750);
    const total = (shares.get("item-a") ?? 0) + (shares.get("item-b") ?? 0);
    expect(total).toBeCloseTo(375, 2);
    // Proportional: item-a carries 400/750 of the weight.
    expect(shares.get("item-a")).toBeCloseTo(200, 2);
    expect(shares.get("item-b")).toBeCloseTo(175, 2);
  });

  it("always sums to exactly the final charge even when the proportional split doesn't divide evenly in cents", () => {
    const members = [
      { itemId: "item-a", weightGrams: 1 },
      { itemId: "item-b", weightGrams: 1 },
      { itemId: "item-c", weightGrams: 1 },
    ];
    const shares = allocateGroupCharge(members, new Prisma.Decimal("10.00"), 3);
    const total = [...shares.values()].reduce((sum, value) => sum + value, 0);
    expect(total).toBeCloseTo(10, 2);
  });

  it("is deterministic across repeated calls for the same group", () => {
    const members = [
      { itemId: "item-b", weightGrams: 1 },
      { itemId: "item-a", weightGrams: 1 },
      { itemId: "item-c", weightGrams: 1 },
    ];
    const first = allocateGroupCharge(members, new Prisma.Decimal("10.00"), 3);
    const second = allocateGroupCharge([...members].reverse(), new Prisma.Decimal("10.00"), 3);
    expect([...first.entries()].sort()).toEqual([...second.entries()].sort());
  });
});
