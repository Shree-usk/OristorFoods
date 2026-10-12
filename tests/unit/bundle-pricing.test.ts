import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { computeBundleDiscountedTotal, distributeBundleTotal } from "@/services/bundle-pricing.service";

const decimal = (value: number) => new Prisma.Decimal(value);

describe("computeBundleDiscountedTotal", () => {
  it("returns the standalone total unchanged when no discount is configured", () => {
    const result = computeBundleDiscountedTotal(decimal(100), { discountType: null, fixedPrice: null, percentOff: null, amountOff: null });
    expect(result.toFixed(2)).toBe("100.00");
  });

  it("uses the fixed price as-is", () => {
    const result = computeBundleDiscountedTotal(decimal(100), { discountType: "FixedPrice", fixedPrice: 80, percentOff: null, amountOff: null });
    expect(result.toFixed(2)).toBe("80.00");
  });

  it("applies a percentage off, rounded to the nearest cent", () => {
    const result = computeBundleDiscountedTotal(decimal(99.99), { discountType: "PercentageOff", fixedPrice: null, percentOff: 10, amountOff: null });
    // 99.99 * 0.9 = 89.991 -> rounds to 89.99
    expect(result.toFixed(2)).toBe("89.99");
  });

  it("applies a fixed amount off", () => {
    const result = computeBundleDiscountedTotal(decimal(100), { discountType: "FixedAmountOff", fixedPrice: null, percentOff: null, amountOff: 30 });
    expect(result.toFixed(2)).toBe("70.00");
  });

  it("floors a fixed amount off at zero rather than going negative", () => {
    const result = computeBundleDiscountedTotal(decimal(20), { discountType: "FixedAmountOff", fixedPrice: null, percentOff: null, amountOff: 50 });
    expect(result.toFixed(2)).toBe("0.00");
  });

  it("throws if FixedPrice is set with no fixedPrice value", () => {
    expect(() => computeBundleDiscountedTotal(decimal(100), { discountType: "FixedPrice", fixedPrice: null, percentOff: null, amountOff: null })).toThrow();
  });
});

describe("distributeBundleTotal", () => {
  it("distributes proportionally to each component's own standalone line value, not evenly", () => {
    // A 200-value jar and a 50-value sachet, undiscounted (total 250) —
    // the jar should keep roughly 4x the sachet's share.
    const result = distributeBundleTotal(
      [
        { componentId: "jar", unitPrice: decimal(200), quantity: 1 },
        { componentId: "sachet", unitPrice: decimal(50), quantity: 1 },
      ],
      decimal(250),
    );
    expect(result.find((r) => r.componentId === "jar")!.unitPriceSnapshot.toFixed(2)).toBe("200.00");
    expect(result.find((r) => r.componentId === "sachet")!.unitPriceSnapshot.toFixed(2)).toBe("50.00");
  });

  it("sums back to the discounted total exactly when at least one component has quantity 1", () => {
    const result = distributeBundleTotal(
      [
        { componentId: "a", unitPrice: decimal(33.33), quantity: 3 },
        { componentId: "b", unitPrice: decimal(10), quantity: 1 },
      ],
      decimal(100),
    );
    const sum = result.reduce((total, row) => {
      const quantity = row.componentId === "a" ? 3 : 1;
      return total.plus(row.unitPriceSnapshot.times(quantity));
    }, new Prisma.Decimal(0));
    expect(sum.toFixed(2)).toBe("100.00");
  });

  it("splits evenly when every component is priced at zero (e.g. a free promotional add-on)", () => {
    const result = distributeBundleTotal(
      [
        { componentId: "a", unitPrice: decimal(0), quantity: 1 },
        { componentId: "b", unitPrice: decimal(0), quantity: 1 },
      ],
      decimal(0),
    );
    expect(result.map((r) => r.unitPriceSnapshot.toFixed(2))).toEqual(["0.00", "0.00"]);
  });

  it("uses the largest-remainder method so the leftover cent goes to the component with the biggest rounded-down remainder", () => {
    // Three equal-value components splitting a total that doesn't divide evenly by 3.
    const result = distributeBundleTotal(
      [
        { componentId: "a", unitPrice: decimal(1), quantity: 1 },
        { componentId: "b", unitPrice: decimal(1), quantity: 1 },
        { componentId: "c", unitPrice: decimal(1), quantity: 1 },
      ],
      decimal(1), // 100 cents / 3 = 33.33 cents each -> 33, 33, 33 + 1 leftover cent to one of them
    );
    const cents = result.map((r) => Math.round(r.unitPriceSnapshot.toNumber() * 100));
    expect(cents.reduce((sum, c) => sum + c, 0)).toBe(100);
    expect(cents.sort()).toEqual([33, 33, 34]);
  });
});
