// tests/unit/download-repository.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  findPublishedResourceBySlug,
  incrementDownloadCount,
  listCategories,
  listPublishedResources,
} from "@/repositories/download.repository";

let sequence = 0;

async function makeCategory(sortOrder = 0) {
  sequence += 1;
  return prisma.downloadCategory.create({
    data: { name: `Category ${sequence}`, slug: `dl-category-${sequence}`, sortOrder },
  });
}

async function makeResource(categoryId: string, overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return prisma.downloadResource.create({
    data: {
      slug: `dl-resource-${sequence}`,
      title: `Resource ${sequence}`,
      thumbnailUrl: "/images/products/export/curry-powder.webp",
      fileUrl: "/downloads/dl-resource.pdf",
      fileType: "PDF",
      fileSizeBytes: 100_000,
      categoryId,
      status: "Published",
      ...overrides,
    },
  });
}

afterEach(async () => {
  await prisma.downloadResource.deleteMany();
  await prisma.downloadCategory.deleteMany();
});

describe("findPublishedResourceBySlug", () => {
  it("finds a Published resource with its category", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id);

    const found = await findPublishedResourceBySlug(resource.slug);
    expect(found?.id).toBe(resource.id);
    expect(found?.category.id).toBe(category.id);
  });

  it("returns null for a Draft resource", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id, { status: "Draft" });

    expect(await findPublishedResourceBySlug(resource.slug)).toBeNull();
  });

  it("returns null for a nonexistent slug", async () => {
    expect(await findPublishedResourceBySlug("does-not-exist")).toBeNull();
  });
});

describe("listCategories", () => {
  it("returns categories ordered by sortOrder", async () => {
    await makeCategory(2);
    await makeCategory(0);
    await makeCategory(1);

    const categories = await listCategories();
    expect(categories.map((c) => c.sortOrder)).toEqual([0, 1, 2]);
  });
});

describe("listPublishedResources", () => {
  it("only returns Published resources, filterable by category slug", async () => {
    const categoryA = await makeCategory();
    const categoryB = await makeCategory();
    await makeResource(categoryA.id);
    await makeResource(categoryA.id, { status: "Draft" });
    const inCategoryB = await makeResource(categoryB.id);

    const all = await listPublishedResources({ skip: 0, take: 10 });
    expect(all.total).toBe(2); // the Draft one excluded

    const filtered = await listPublishedResources({ categorySlug: categoryB.slug, skip: 0, take: 10 });
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]?.id).toBe(inCategoryB.id);
  });

  it("paginates", async () => {
    const category = await makeCategory();
    await makeResource(category.id);
    await makeResource(category.id);
    await makeResource(category.id);

    const page = await listPublishedResources({ skip: 1, take: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(3);
  });
});

describe("incrementDownloadCount", () => {
  it("increments downloadCount without touching updatedAt", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id);

    await incrementDownloadCount(resource.id);

    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(1);
    expect(refreshed.updatedAt.getTime()).toBe(resource.updatedAt.getTime());
  });

  it("two sequential increments both land (no lost update)", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id);

    await incrementDownloadCount(resource.id);
    await incrementDownloadCount(resource.id);

    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(2);
  });
});
