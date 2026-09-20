// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { createProduct, searchPublishedProducts } from "@/repositories/product.repository";
import { prisma } from "@/lib/db";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("searchPublishedProducts", () => {
  it("matches a published product by a substring of its name, case-insensitively", async () => {
    await createProduct({
      sku: "SEARCH-REPO-1",
      slug: "search-repo-curry",
      name: "Roasted Curry Powder",
      status: "Published",
    });

    const results = await searchPublishedProducts("CURRY");

    expect(results.map((p) => p.slug)).toEqual(["search-repo-curry"]);
  });

  it("matches by SKU", async () => {
    await createProduct({
      sku: "SEARCH-REPO-SKU-1",
      slug: "search-repo-sku",
      name: "Unrelated Name",
      status: "Published",
    });

    const results = await searchPublishedProducts("SEARCH-REPO-SKU-1");

    expect(results.map((p) => p.slug)).toEqual(["search-repo-sku"]);
  });

  it("excludes non-Published products", async () => {
    await createProduct({
      sku: "SEARCH-REPO-2",
      slug: "search-repo-draft",
      name: "Curry Draft",
      status: "Draft",
    });

    const results = await searchPublishedProducts("curry");

    expect(results).toEqual([]);
  });

  it("bounds the result count when take is given", async () => {
    await createProduct({ sku: "SEARCH-REPO-3", slug: "search-repo-3", name: "Curry A", status: "Published" });
    await createProduct({ sku: "SEARCH-REPO-4", slug: "search-repo-4", name: "Curry B", status: "Published" });

    const results = await searchPublishedProducts("curry", { take: 1 });

    expect(results).toHaveLength(1);
  });
});
