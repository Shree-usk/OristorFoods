// tests/unit/download-routes.test.ts
// @vitest-environment node
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { GET as getDownloads } from "@/app/api/downloads/route";
import { GET as getDownloadFile } from "@/app/api/downloads/[slug]/file/route";
import { prisma } from "@/lib/db";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

let sequence = 0;
const TEST_FILE_DIR = path.join(process.cwd(), "public", "downloads");

async function makeCategory() {
  sequence += 1;
  return prisma.downloadCategory.create({ data: { name: `Category ${sequence}`, slug: `dl-route-category-${sequence}` } });
}

async function makeResourceWithRealFile(categoryId: string, overrides: Record<string, unknown> = {}) {
  sequence += 1;
  const fileName = `dl-route-test-${sequence}.pdf`;
  await mkdir(TEST_FILE_DIR, { recursive: true });
  await writeFile(path.join(TEST_FILE_DIR, fileName), "%PDF-1.4 test file content");
  return prisma.downloadResource.create({
    data: {
      slug: `dl-route-resource-${sequence}`,
      title: `Resource ${sequence}`,
      thumbnailUrl: "/images/products/export/curry-powder.webp",
      fileUrl: `/downloads/${fileName}`,
      fileType: "PDF",
      fileSizeBytes: 27,
      categoryId,
      status: "Published",
      ...overrides,
    },
  });
}

function sessionFor(userId: string) {
  return { user: { id: userId }, expires: new Date(Date.now() + 60_000).toISOString() };
}

beforeEach(() => {
  mockAuth.mockReset();
  mockAuth.mockResolvedValue(null);
});

afterEach(async () => {
  await prisma.downloadResource.deleteMany();
  await prisma.downloadCategory.deleteMany();
  await rm(TEST_FILE_DIR, { recursive: true, force: true });
});

describe("GET /api/downloads", () => {
  it("returns Published resources", async () => {
    const category = await makeCategory();
    await makeResourceWithRealFile(category.id);

    const response = await getDownloads(new Request("http://localhost/api/downloads"));
    const body = (await response.json()) as { total: number };
    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
  });

  it("filters by category", async () => {
    const categoryA = await makeCategory();
    const categoryB = await makeCategory();
    await makeResourceWithRealFile(categoryA.id);
    await makeResourceWithRealFile(categoryB.id);

    const response = await getDownloads(new Request(`http://localhost/api/downloads?category=${categoryB.slug}`));
    const body = (await response.json()) as { total: number };
    expect(body.total).toBe(1);
  });
});

describe("GET /api/downloads/[slug]/file", () => {
  it("serves the file and increments downloadCount", async () => {
    const category = await makeCategory();
    const resource = await makeResourceWithRealFile(category.id);

    const response = await getDownloadFile(new Request(`http://localhost/api/downloads/${resource.slug}/file`), {
      params: Promise.resolve({ slug: resource.slug }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(1);
  });

  it("returns 404 for a Draft resource (not shown, not servable)", async () => {
    const category = await makeCategory();
    const resource = await makeResourceWithRealFile(category.id, { status: "Draft" });

    const response = await getDownloadFile(new Request(`http://localhost/api/downloads/${resource.slug}/file`), {
      params: Promise.resolve({ slug: resource.slug }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 for a nonexistent slug", async () => {
    const response = await getDownloadFile(new Request("http://localhost/api/downloads/does-not-exist/file"), {
      params: Promise.resolve({ slug: "does-not-exist" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 401 for a requiresAuth resource with no session, before recordDownload runs", async () => {
    const category = await makeCategory();
    const resource = await makeResourceWithRealFile(category.id, { requiresAuth: true });

    const response = await getDownloadFile(new Request(`http://localhost/api/downloads/${resource.slug}/file`), {
      params: Promise.resolve({ slug: resource.slug }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(0);
  });

  it("serves a requiresAuth resource for an authenticated caller", async () => {
    const category = await makeCategory();
    const resource = await makeResourceWithRealFile(category.id, { requiresAuth: true });
    mockAuth.mockResolvedValue(sessionFor("user-1"));

    const response = await getDownloadFile(new Request(`http://localhost/api/downloads/${resource.slug}/file`), {
      params: Promise.resolve({ slug: resource.slug }),
    });

    expect(response.status).toBe(200);
  });

  it("returns 404, not a 500, when the DB row's file is missing on disk", async () => {
    const category = await makeCategory();
    const resource = await prisma.downloadResource.create({
      data: {
        slug: "dl-route-missing-file",
        title: "Missing file resource",
        thumbnailUrl: "/images/products/export/curry-powder.webp",
        fileUrl: "/downloads/does-not-exist-on-disk.pdf",
        fileType: "PDF",
        fileSizeBytes: 100,
        categoryId: category.id,
        status: "Published",
      },
    });

    const response = await getDownloadFile(new Request(`http://localhost/api/downloads/${resource.slug}/file`), {
      params: Promise.resolve({ slug: resource.slug }),
    });

    expect(response.status).toBe(404);
    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(0); // never reached recordDownload
  });
});
