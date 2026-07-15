// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createCategory } from "@/repositories/category.repository";
import { getCategoryTreeForStorefront } from "@/services/category.service";

afterEach(async () => {
  await prisma.category.deleteMany();
});

describe("category.service", () => {
  it("excludes inactive categories from the storefront tree", async () => {
    await createCategory({ name: "Spices", slug: "spices", status: "Active" });
    await createCategory({ name: "Discontinued Line", slug: "discontinued", status: "Inactive" });

    const tree = await getCategoryTreeForStorefront();

    expect(tree.map((c) => c.slug)).toEqual(["spices"]);
  });
});
