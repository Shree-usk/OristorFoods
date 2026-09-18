// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createCategory,
  findCategoryBySlug,
  getCategoryAncestorPath,
  getCategoryTree,
  listCategoryAndDescendantIds,
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

  it("lists a category's own id plus every descendant id", async () => {
    const root = await createCategory({ name: "Spices", slug: "spices-2" });
    const child = await createCategory({
      name: "Curry Powders",
      slug: "curry-powders-2",
      parent: { connect: { id: root.id } },
    });
    const grandchild = await createCategory({
      name: "Roasted Curry Powders",
      slug: "roasted-curry-powders",
      parent: { connect: { id: child.id } },
    });
    const unrelated = await createCategory({ name: "Snacks", slug: "snacks" });

    const ids = await listCategoryAndDescendantIds(root.id);

    expect(ids).toContain(root.id);
    expect(ids).toContain(child.id);
    expect(ids).toContain(grandchild.id);
    expect(ids).not.toContain(unrelated.id);
    expect(ids).toHaveLength(3);
  });

  it("returns just the category's own id when it has no children", async () => {
    const leaf = await createCategory({ name: "Standalone", slug: "standalone" });

    expect(await listCategoryAndDescendantIds(leaf.id)).toEqual([leaf.id]);
  });
});

describe("getCategoryAncestorPath", () => {
  it("returns a single-item path for a root category with no parent", async () => {
    const root = await createCategory({ name: "Root", slug: "path-root" });

    const path = await getCategoryAncestorPath(root.id);

    expect(path).toEqual([{ name: "Root", slug: "path-root" }]);
  });

  it("returns the full root-to-leaf path for a nested category", async () => {
    const root = await createCategory({ name: "Spices", slug: "path-spices" });
    const child = await createCategory({
      name: "Curry Powders",
      slug: "path-curry-powders",
      parent: { connect: { id: root.id } },
    });

    const path = await getCategoryAncestorPath(child.id);

    expect(path).toEqual([
      { name: "Spices", slug: "path-spices" },
      { name: "Curry Powders", slug: "path-curry-powders" },
    ]);
  });
});
