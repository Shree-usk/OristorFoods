// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { evaluatePromotionsForCart } from "@/services/promotion.service";

const NAME_PREFIX = "PROMO-SVC-";
let sequence = 0;
const DAY_MS = 24 * 60 * 60 * 1000;

async function makePromotion(overrides: Partial<Parameters<typeof prisma.promotion.create>[0]["data"]> = {}) {
  sequence += 1;
  return prisma.promotion.create({
    data: {
      name: `${NAME_PREFIX}${sequence}`,
      displayLabel: `${NAME_PREFIX}${sequence} label`,
      discountType: "PercentageOff",
      percentOff: "15",
      startDate: new Date(Date.now() - DAY_MS),
      endDate: new Date(Date.now() + DAY_MS),
      ...overrides,
    },
  });
}

afterEach(async () => {
  await prisma.promotionScopeProduct.deleteMany();
  await prisma.promotionScopeCategory.deleteMany();
  await prisma.promotion.deleteMany({ where: { name: { startsWith: NAME_PREFIX } } });
});

describe("evaluatePromotionsForCart", () => {
  it("returns only currently-active promotions", async () => {
    await makePromotion(); // active
    await makePromotion({ startDate: new Date(Date.now() + DAY_MS), endDate: new Date(Date.now() + 2 * DAY_MS) }); // future
    await makePromotion({ startDate: new Date(Date.now() - 2 * DAY_MS), endDate: new Date(Date.now() - DAY_MS) }); // expired
    await makePromotion({ isActive: false }); // deactivated

    const lines = [{ productId: "p1", categoryIds: [], lineTotal: 1000 }];
    const eligible = await evaluatePromotionsForCart(lines, 1000);
    expect(eligible).toHaveLength(1);
  });

  it("filters out promotions whose minimum order value isn't met", async () => {
    await makePromotion({ minOrderValue: "5000.00" });
    const lines = [{ productId: "p1", categoryIds: [], lineTotal: 1000 }];
    expect(await evaluatePromotionsForCart(lines, 1000)).toEqual([]);
  });

  it("filters out promotions with no matching scope in the cart", async () => {
    const category = await prisma.category.create({ data: { name: "Promo Svc Tea", slug: "promo-svc-tea" } });
    await makePromotion({ scope: "Category", scopeCategories: { create: [{ categoryId: category.id }] } });

    const lines = [{ productId: "p1", categoryIds: ["some-other-category"], lineTotal: 1000 }];
    expect(await evaluatePromotionsForCart(lines, 1000)).toEqual([]);

    await prisma.category.delete({ where: { id: category.id } });
  });

  it("reports the matching-lines total, not the full subtotal, for a scoped promotion", async () => {
    const category = await prisma.category.create({ data: { name: "Promo Svc Spices", slug: "promo-svc-spices" } });
    await makePromotion({ scope: "Category", scopeCategories: { create: [{ categoryId: category.id }] } });

    const lines = [
      { productId: "p1", categoryIds: [category.id], lineTotal: 600 },
      { productId: "p2", categoryIds: ["unrelated"], lineTotal: 400 },
    ];
    const eligible = await evaluatePromotionsForCart(lines, 1000);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].matchingLinesTotal).toBe(600);

    await prisma.category.delete({ where: { id: category.id } });
  });
});
