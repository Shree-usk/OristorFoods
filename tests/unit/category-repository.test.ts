// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createCategory,
  findCategoryBySlug,
  getCategoryTree,
  listChildCategories,
  listRootCategories,
} from "@/repositories/category.repository";

afterEach(async () => {
  await prisma.category.deleteMany();
});

describe("category.repository", () => {
  it("creates a category and finds it by slug", async () => {
    await createCategory({ name: "Spice Blends", slug: "spice-blends" });

    const found = await findCategoryBySlug("spice-blends");

    expect(found?.name).toBe("Spice Blends");
  });

  it("rejects a duplicate slug", async () => {
    await createCategory({ name: "Spice Blends", slug: "spice-blends" });

    await expect(
      createCategory({ name: "Other", slug: "spice-blends" }),
    ).rejects.toThrow();
  });

  it("supports arbitrary-depth nesting via parentId", async () => {
    const root = await createCategory({ name: "Products", slug: "products" });
    const child = await createCategory({
      name: "Spices",
      slug: "spices",
      parent: { connect: { id: root.id } },
    });
    await createCategory({
      name: "Curry Powders",
      slug: "curry-powders",
      parent: { connect: { id: child.id } },
    });

    const roots = await listRootCategories();
    const children = await listChildCategories(root.id);
    const tree = await getCategoryTree();

    expect(roots.map((c) => c.slug)).toEqual(["products"]);
    expect(children.map((c) => c.slug)).toEqual(["spices"]);
    expect(tree[0].children[0].children[0].slug).toBe("curry-powders");
  });
});
