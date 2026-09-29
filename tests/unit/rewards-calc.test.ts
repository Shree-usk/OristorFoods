import { describe, expect, it } from "vitest";

import { calculatePointsRedemption, type PointsRedemptionCalcInput } from "@/services/rewards-calc";

function input(overrides: Partial<PointsRedemptionCalcInput> = {}): PointsRedemptionCalcInput {
  return {
    pointsRequested: 100,
    spendableBalance: 1000,
    pointsToCurrencyRate: 1,
    maxRedeemablePointsPerOrder: null,
    payableBeforePoints: 1000,
    ...overrides,
  };
}

describe("calculatePointsRedemption — disabled/invalid input", () => {
  it("returns zero when the conversion rate is null (redemption off)", () => {
    expect(calculatePointsRedemption(input({ pointsToCurrencyRate: null }))).toEqual({ pointsToRedeem: 0, discountValue: 0 });
  });

  it("returns zero when the conversion rate is zero or negative", () => {
    expect(calculatePointsRedemption(input({ pointsToCurrencyRate: 0 }))).toEqual({ pointsToRedeem: 0, discountValue: 0 });
    expect(calculatePointsRedemption(input({ pointsToCurrencyRate: -1 }))).toEqual({ pointsToRedeem: 0, discountValue: 0 });
  });

  it("returns zero for a non-positive points request", () => {
    expect(calculatePointsRedemption(input({ pointsRequested: 0 }))).toEqual({ pointsToRedeem: 0, discountValue: 0 });
    expect(calculatePointsRedemption(input({ pointsRequested: -5 }))).toEqual({ pointsToRedeem: 0, discountValue: 0 });
  });

  it("returns zero when nothing is payable", () => {
    expect(calculatePointsRedemption(input({ payableBeforePoints: 0 }))).toEqual({ pointsToRedeem: 0, discountValue: 0 });
  });
});

describe("calculatePointsRedemption — clamping", () => {
  it("clamps to the spendable balance", () => {
    expect(calculatePointsRedemption(input({ pointsRequested: 500, spendableBalance: 200 }))).toEqual({ pointsToRedeem: 200, discountValue: 200 });
  });

  it("clamps to the per-order cap when set", () => {
    expect(calculatePointsRedemption(input({ pointsRequested: 500, maxRedeemablePointsPerOrder: 50 }))).toEqual({ pointsToRedeem: 50, discountValue: 50 });
  });

  it("clamps to the payable amount so the discount can never exceed what's owed", () => {
    expect(calculatePointsRedemption(input({ pointsRequested: 500, payableBeforePoints: 30, pointsToCurrencyRate: 1 }))).toEqual({
      pointsToRedeem: 30,
      discountValue: 30,
    });
  });

  it("floors a fractional points request", () => {
    expect(calculatePointsRedemption(input({ pointsRequested: 10.9 }))).toEqual({ pointsToRedeem: 10, discountValue: 10 });
  });

  it("applies the tightest of several simultaneous caps", () => {
    const result = calculatePointsRedemption(
      input({ pointsRequested: 1000, spendableBalance: 300, maxRedeemablePointsPerOrder: 100, payableBeforePoints: 40, pointsToCurrencyRate: 1 }),
    );
    expect(result).toEqual({ pointsToRedeem: 40, discountValue: 40 });
  });

  it("rounds the discount value to 2 decimal places under a fractional rate", () => {
    const result = calculatePointsRedemption(input({ pointsRequested: 3, pointsToCurrencyRate: 0.333, payableBeforePoints: 100 }));
    expect(result.pointsToRedeem).toBe(3);
    expect(result.discountValue).toBe(1.0); // 3 * 0.333 = 0.999 -> rounds to 1.00
  });

  it("never produces a negative points-to-redeem count when every cap is exhausted", () => {
    expect(calculatePointsRedemption(input({ pointsRequested: 100, spendableBalance: 0 }))).toEqual({ pointsToRedeem: 0, discountValue: 0 });
  });
});
