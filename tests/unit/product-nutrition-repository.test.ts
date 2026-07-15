// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  addProductIngredient,
  attachAllergen,
  createAllergen,
  createProduct,
  getProductNutrition,
  listProductAllergens,
  listProductIngredients,
  setProductNutrition,
} from "@/repositories/product.repository";

afterEach(async () => {
  await prisma.product.deleteMany();
  await prisma.allergen.deleteMany();
});

describe("product nutrition, ingredients, allergens", () => {
  it("attaches one nutrition record, an ordered ingredient list, and allergens", async () => {
    const product = await createProduct({
      sku: "ORI-CP-100",
      slug: "curry-powder-100g",
      name: "Roasted Curry Powder 100g",
    });
    const mustard = await createAllergen({ name: "Mustard" });

    await setProductNutrition({
      product: { connect: { id: product.id } },
      servingSize: "1 tsp (5g)",
      calories: "18.00",
      protein: "0.80",
      fat: "0.70",
      saturatedFat: "0.10",
      carbohydrates: "2.50",
      sugar: "0.30",
      fibre: "1.10",
      sodium: "2.00",
    });
    await addProductIngredient({
      product: { connect: { id: product.id } },
      name: "Coriander",
      sortOrder: 1,
    });
    await addProductIngredient({
      product: { connect: { id: product.id } },
      name: "Mustard seed",
      isAllergen: true,
      sortOrder: 2,
    });
    await attachAllergen(product.id, mustard.id);

    const nutrition = await getProductNutrition(product.id);
    const ingredients = await listProductIngredients(product.id);
    const allergens = await listProductAllergens(product.id);

    expect(nutrition?.calories.toFixed(2)).toBe("18.00");
    expect(ingredients.map((i) => i.name)).toEqual(["Coriander", "Mustard seed"]);
    expect(ingredients[1].isAllergen).toBe(true);
    expect(allergens.map((a) => a.name)).toEqual(["Mustard"]);
  });
});
