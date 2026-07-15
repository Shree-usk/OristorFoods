import { describe, expect, it } from "vitest";

import {
  resolvePriceParamsSchema,
  salePriceSchema,
  standardPriceSchema,
  volumeDiscountTierSchema,
} from "@/validation/pricing.schema";

describe("standardPriceSchema", () => {
  it("rejects a negative price", () => {
    expect(standardPriceSchema.safeParse({ productId: "p1", price: -5 }).success).toBe(false);
  });

  it("accepts a zero-or-positive price", () => {
    expect(standardPriceSchema.safeParse({ productId: "p1", price: 0 }).success).toBe(true);
  });
});

describe("salePriceSchema", () => {
  it("rejects an endDate before startDate", () => {
    const result = salePriceSchema.safeParse({
      productId: "p1",
      price: 100,
      startDate: new Date("2026-07-10"),
      endDate: new Date("2026-07-01"),
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid date range", () => {
    const result = salePriceSchema.safeParse({
      productId: "p1",
      price: 100,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-10"),
    });

    expect(result.success).toBe(true);
  });
});

describe("volumeDiscountTierSchema", () => {
  it("rejects a tier with neither discountPrice nor discountPercent", () => {
    const result = volumeDiscountTierSchema.safeParse({
      productId: "p1",
      minQuantity: 10,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a tier with both discountPrice and discountPercent", () => {
    const result = volumeDiscountTierSchema.safeParse({
      productId: "p1",
      minQuantity: 10,
      discountPrice: 400,
      discountPercent: 10,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a tier with exactly one discount type", () => {
    const result = volumeDiscountTierSchema.safeParse({
      productId: "p1",
      minQuantity: 10,
      discountPercent: 10,
    });

    expect(result.success).toBe(true);
  });
});

describe("resolvePriceParamsSchema", () => {
  it("accepts params with only productId", () => {
    expect(resolvePriceParamsSchema.safeParse({ productId: "p1" }).success).toBe(true);
  });

  it("rejects a negative quantity", () => {
    expect(
      resolvePriceParamsSchema.safeParse({ productId: "p1", quantity: -1 }).success,
    ).toBe(false);
  });
});
