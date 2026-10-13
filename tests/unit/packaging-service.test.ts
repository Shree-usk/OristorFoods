import { describe, expect, it } from "vitest";

import { isAvailabilityCompatible, packagingSelectionValidity, type PackagingOptionForValidity } from "@/services/packaging.service";

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
