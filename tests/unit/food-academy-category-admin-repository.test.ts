// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  createFoodAcademyCategoryAdmin,
  deleteFoodAcademyCategoryById,
  findFoodAcademyCategoryByIdForAdmin,
  listAllFoodAcademyCategoriesForAdmin,
  reorderFoodAcademyCategories,
  updateFoodAcademyCategoryAdmin,
} from "@/repositories/food-academy.repository";
import { cleanupRecipes, makeFoodAcademyCategory, makeFoodAcademyEntry } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
});

describe("createFoodAcademyCategoryAdmin", () => {
  it("creates a category and assigns it the next sortOrder", async () => {
    await makeFoodAcademyCategory({ slug: "existing-1" });
    const created = await createFoodAcademyCategoryAdmin({ name: "New Category", slug: "new-category-1" });

    expect(created.name).toBe("New Category");
    expect(created.sortOrder).toBeGreaterThanOrEqual(1);
    expect(created._count.entries).toBe(0);
  });
});

describe("updateFoodAcademyCategoryAdmin", () => {
  it("updates fields including the new tile image fields", async () => {
    const category = await makeFoodAcademyCategory();
    const updated = await updateFoodAcademyCategoryAdmin(category.id, {
      name: "Renamed",
      slug: category.slug,
      tileImageUrl: "/images/tile.webp",
      tileImageAlt: "A tile image",
    });

    expect(updated.name).toBe("Renamed");
    expect(updated.tileImageUrl).toBe("/images/tile.webp");
    expect(updated.tileImageAlt).toBe("A tile image");
  });
});

describe("deleteFoodAcademyCategoryById", () => {
  it("removes the category row", async () => {
    const category = await makeFoodAcademyCategory();
    await deleteFoodAcademyCategoryById(category.id);
    expect(await findFoodAcademyCategoryByIdForAdmin(category.id)).toBeNull();
  });
});

describe("listAllFoodAcademyCategoriesForAdmin", () => {
  it("includes every status (not just Active) and an entry count, ordered by sortOrder", async () => {
    const active = await makeFoodAcademyCategory({ name: "Active One" });
    const inactive = await makeFoodAcademyCategory({ name: "Inactive One", status: "Inactive" });
    await makeFoodAcademyEntry({ categoryId: active.id });

    const rows = await listAllFoodAcademyCategoriesForAdmin();
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(active.id)?._count.entries).toBe(1);
    expect(byId.get(inactive.id)?.status).toBe("Inactive");
  });
});

describe("reorderFoodAcademyCategories", () => {
  it("sets sortOrder to match the given id order", async () => {
    const first = await makeFoodAcademyCategory();
    const second = await makeFoodAcademyCategory();
    const third = await makeFoodAcademyCategory();

    await reorderFoodAcademyCategories([third.id, first.id, second.id]);

    const rows = await prisma.foodAcademyCategory.findMany({
      where: { id: { in: [first.id, second.id, third.id] } },
      select: { id: true, sortOrder: true },
    });
    const sortOrderById = new Map(rows.map((r) => [r.id, r.sortOrder]));
    expect(sortOrderById.get(third.id)).toBe(0);
    expect(sortOrderById.get(first.id)).toBe(1);
    expect(sortOrderById.get(second.id)).toBe(2);
  });
});
