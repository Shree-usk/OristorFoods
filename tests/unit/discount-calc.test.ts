import { describe, expect, it } from "vitest";

import { calculateDiscount, matchingLinesTotal, type DiscountRule, type DiscountableLine } from "@/services/discount.service";

function rule(overrides: Partial<DiscountRule> = {}): DiscountRule {
  return {
    sourceType: "coupon",
    sourceId: "coupon-1",
    label: "Coupon SAVE10",
    discountType: "PercentageOff",
    percentOff: 10,
    amountOff: null,
    scope: "AllProducts",
    scopeProductIds: [],
    scopeCategoryIds: [],
    minOrderValue: null,
    stackable: false,
    priority: 0,
    ...overrides,
  };
}

function line(overrides: Partial<DiscountableLine> = {}): DiscountableLine {
  return { productId: "p1", categoryIds: [], lineTotal: 1000, ...overrides };
}

describe("matchingLinesTotal", () => {
  it("sums every line for AllProducts scope", () => {
    expect(matchingLinesTotal(rule({ scope: "AllProducts" }), [line({ lineTotal: 500 }), line({ lineTotal: 300 })])).toBe(800);
  });

  it("sums only matching product lines for Product scope", () => {
    const lines = [line({ productId: "p1", lineTotal: 500 }), line({ productId: "p2", lineTotal: 300 })];
    expect(matchingLinesTotal(rule({ scope: "Product", scopeProductIds: ["p1"] }), lines)).toBe(500);
  });

  it("sums only matching category lines for Category scope", () => {
    const lines = [line({ categoryIds: ["cat-spices"], lineTotal: 500 }), line({ categoryIds: ["cat-tea"], lineTotal: 300 })];
    expect(matchingLinesTotal(rule({ scope: "Category", scopeCategoryIds: ["cat-spices"] }), lines)).toBe(500);
  });

  it("returns 0 when nothing in the cart matches scope", () => {
    expect(matchingLinesTotal(rule({ scope: "Product", scopeProductIds: ["p-other"] }), [line({ productId: "p1" })])).toBe(0);
  });
});

describe("calculateDiscount — discount types", () => {
  it("computes PercentageOff against the matching subtotal", () => {
    const result = calculateDiscount({
      lines: [line({ lineTotal: 1000 })],
      subtotal: 1000,
      deliveryCharge: 350,
      coupon: rule({ discountType: "PercentageOff", percentOff: 10 }),
      promotions: [],
    });
    expect(result).toMatchObject({ totalAmount: 100, freeShippingApplied: false });
    expect(result.applied).toEqual([{ sourceType: "coupon", sourceId: "coupon-1", label: "Coupon SAVE10", amount: 100, isFreeShipping: false }]);
  });

  it("computes FixedAmountOff, capped at the matching subtotal", () => {
    const result = calculateDiscount({
      lines: [line({ lineTotal: 1000 })],
      subtotal: 1000,
      deliveryCharge: 0,
      coupon: rule({ discountType: "FixedAmountOff", amountOff: 5000 }),
      promotions: [],
    });
    expect(result.totalAmount).toBe(1000); // clamped — never exceeds the matching subtotal
  });

  it("computes FreeShipping as the current delivery charge, excluded from totalAmount", () => {
    const result = calculateDiscount({
      lines: [line({ lineTotal: 1000 })],
      subtotal: 1000,
      deliveryCharge: 350,
      coupon: rule({ discountType: "FreeShipping", percentOff: null, amountOff: null }),
      promotions: [],
    });
    expect(result.freeShippingApplied).toBe(true);
    expect(result.totalAmount).toBe(0);
    expect(result.applied[0]).toMatchObject({ isFreeShipping: true, amount: 350 });
  });

  it("a FreeShipping coupon contributes nothing when delivery is already free", () => {
    const result = calculateDiscount({
      lines: [line({ lineTotal: 1000 })],
      subtotal: 1000,
      deliveryCharge: 0,
      coupon: rule({ discountType: "FreeShipping", percentOff: null, amountOff: null }),
      promotions: [],
    });
    expect(result).toEqual({ applied: [], totalAmount: 0, freeShippingApplied: false });
  });
});

describe("calculateDiscount — scope restriction", () => {
  it("only discounts matching lines for Category scope, not the whole subtotal", () => {
    const lines = [line({ productId: "p1", categoryIds: ["spices"], lineTotal: 600 }), line({ productId: "p2", categoryIds: ["tea"], lineTotal: 400 })];
    const result = calculateDiscount({
      lines,
      subtotal: 1000,
      deliveryCharge: 0,
      coupon: rule({ discountType: "PercentageOff", percentOff: 10, scope: "Category", scopeCategoryIds: ["spices"] }),
      promotions: [],
    });
    expect(result.totalAmount).toBe(60); // 10% of the 600 matching, not the full 1000
  });

  it("a coupon scoped to a category absent from the cart contributes nothing", () => {
    const result = calculateDiscount({
      lines: [line({ categoryIds: ["tea"], lineTotal: 1000 })],
      subtotal: 1000,
      deliveryCharge: 0,
      coupon: rule({ scope: "Category", scopeCategoryIds: ["spices"] }),
      promotions: [],
    });
    expect(result.applied).toEqual([]);
  });
});

describe("calculateDiscount — min-order-value boundary", () => {
  it("applies exactly at the minimum", () => {
    const result = calculateDiscount({
      lines: [line({ lineTotal: 1000 })],
      subtotal: 1000,
      deliveryCharge: 0,
      coupon: rule({ minOrderValue: 1000 }),
      promotions: [],
    });
    expect(result.applied).toHaveLength(1);
  });

  it("does not apply one cent under the minimum", () => {
    const result = calculateDiscount({
      lines: [line({ lineTotal: 999.99 })],
      subtotal: 999.99,
      deliveryCharge: 0,
      coupon: rule({ minOrderValue: 1000 }),
      promotions: [],
    });
    expect(result.applied).toEqual([]);
  });
});

describe("calculateDiscount — stacking, take-best, and tie-breaks", () => {
  it("stacks two stackable sources", () => {
    const result = calculateDiscount({
      lines: [line({ lineTotal: 1000 })],
      subtotal: 1000,
      deliveryCharge: 0,
      coupon: rule({ discountType: "PercentageOff", percentOff: 10, stackable: true }),
      promotions: [rule({ sourceType: "promotion", sourceId: "promo-1", label: "Weekend Sale", discountType: "FixedAmountOff", amountOff: 50, percentOff: null, stackable: true })],
    });
    expect(result.applied).toHaveLength(2);
    expect(result.totalAmount).toBe(150); // 100 + 50
  });

  it("take-best when only one side is stackable — the larger discount wins, the other is dropped", () => {
    const result = calculateDiscount({
      lines: [line({ lineTotal: 1000 })],
      subtotal: 1000,
      deliveryCharge: 0,
      coupon: rule({ discountType: "PercentageOff", percentOff: 10, stackable: false }), // 100
      promotions: [rule({ sourceType: "promotion", sourceId: "promo-1", label: "Big Sale", discountType: "FixedAmountOff", amountOff: 200, percentOff: null, stackable: true })], // 200
    });
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].sourceType).toBe("promotion");
    expect(result.totalAmount).toBe(200);
  });

  it("a coupon wins a tie over a promotion of equal amount", () => {
    const result = calculateDiscount({
      lines: [line({ lineTotal: 1000 })],
      subtotal: 1000,
      deliveryCharge: 0,
      coupon: rule({ discountType: "FixedAmountOff", amountOff: 100, percentOff: null }),
      promotions: [rule({ sourceType: "promotion", sourceId: "promo-1", label: "Sale", discountType: "FixedAmountOff", amountOff: 100, percentOff: null })],
    });
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].sourceType).toBe("coupon");
  });

  it("among tied promotions, lower priority wins", () => {
    const result = calculateDiscount({
      lines: [line({ lineTotal: 1000 })],
      subtotal: 1000,
      deliveryCharge: 0,
      coupon: null,
      promotions: [
        rule({ sourceType: "promotion", sourceId: "promo-low", label: "Low Priority", discountType: "FixedAmountOff", amountOff: 100, percentOff: null, priority: 5 }),
        rule({ sourceType: "promotion", sourceId: "promo-high", label: "High Priority", discountType: "FixedAmountOff", amountOff: 100, percentOff: null, priority: 1 }),
      ],
    });
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].sourceId).toBe("promo-high");
  });

  it("no coupon and no eligible promotions yields an empty result", () => {
    const result = calculateDiscount({ lines: [line()], subtotal: 1000, deliveryCharge: 0, coupon: null, promotions: [] });
    expect(result).toEqual({ applied: [], totalAmount: 0, freeShippingApplied: false });
  });
});
