// tests/unit/download-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { DownloadAuthRequiredError, DownloadResourceNotFoundError } from "@/services/download.errors";
import { listCategories, listResources, recordDownload, resolveFileAccess } from "@/services/download.service";

let sequence = 0;

async function makeCategory() {
  sequence += 1;
  return prisma.downloadCategory.create({ data: { name: `Category ${sequence}`, slug: `dl-svc-category-${sequence}` } });
}

async function makeResource(categoryId: string, overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return prisma.downloadResource.create({
    data: {
      slug: `dl-svc-resource-${sequence}`,
      title: `Resource ${sequence}`,
      thumbnailUrl: "/images/products/export/curry-powder.webp",
      fileUrl: "/downloads/dl-svc-resource.pdf",
      fileType: "PDF",
      fileSizeBytes: 50_000,
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

describe("listCategories / listResources", () => {
  it("lists categories and Published resources as cards", async () => {
    const category = await makeCategory();
    await makeResource(category.id, { title: "Nutrition Guide" });

    const categories = await listCategories();
    expect(categories.map((c) => c.id)).toContain(category.id);

    const page = await listResources({ page: 1, pageSize: 24 });
    expect(page.total).toBe(1);
    expect(page.items[0]?.title).toBe("Nutrition Guide");
    expect(page.items[0]?.category.id).toBe(category.id);
  });
});

describe("resolveFileAccess", () => {
  it("resolves a public Published resource for an unauthenticated caller", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id, { requiresAuth: false });

    const resolved = await resolveFileAccess(resource.slug, false);
    expect(resolved.id).toBe(resource.id);
  });

  it("throws DownloadResourceNotFoundError for a Draft resource", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id, { status: "Draft" });

    await expect(resolveFileAccess(resource.slug, true)).rejects.toThrow(DownloadResourceNotFoundError);
  });

  it("throws DownloadResourceNotFoundError for a nonexistent slug", async () => {
    await expect(resolveFileAccess("does-not-exist", true)).rejects.toThrow(DownloadResourceNotFoundError);
  });

  it("throws DownloadAuthRequiredError for a requiresAuth resource with no session", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id, { requiresAuth: true });

    await expect(resolveFileAccess(resource.slug, false)).rejects.toThrow(DownloadAuthRequiredError);
  });

  it("resolves a requiresAuth resource for an authenticated caller", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id, { requiresAuth: true });

    const resolved = await resolveFileAccess(resource.slug, true);
    expect(resolved.id).toBe(resource.id);
  });
});

describe("recordDownload", () => {
  it("increments the resource's downloadCount", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id);

    await recordDownload(resource.id);

    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(1);
  });
});
