// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createBrand, findBrandBySlug, listBrands } from "@/repositories/brand.repository";

afterEach(async () => {
  await prisma.brand.deleteMany();
});

describe("brand.repository", () => {
  it("creates a brand and finds it by slug", async () => {
    await createBrand({ name: "Oristor", slug: "oristor" });

    const found = await findBrandBySlug("oristor");

    expect(found?.name).toBe("Oristor");
  });

  it("rejects a duplicate slug", async () => {
    await createBrand({ name: "Oristor", slug: "oristor" });

    await expect(createBrand({ name: "Other", slug: "oristor" })).rejects.toThrow();
  });

  it("lists all brands alphabetically", async () => {
    await createBrand({ name: "Zesty Co", slug: "zesty-co" });
    await createBrand({ name: "Ambrosia", slug: "ambrosia" });

    const brands = await listBrands();

    expect(brands.map((b) => b.name)).toEqual(["Ambrosia", "Zesty Co"]);
  });
});
