// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  clearOtherDefaultFeaturedProducts,
  countPublishedPerfectMatchPairings,
  createPerfectMatchPairing,
  createPerfectMatchProduct,
  deletePerfectMatchPairingById,
  deletePerfectMatchProductById,
  findPerfectMatchProductByProductId,
  getPerfectMatchSetting,
  listPerfectMatchPairingsByProduct,
  listPublishedPerfectMatchPairingsByProduct,
  listPublishedPerfectMatchProducts,
  nextPerfectMatchPairingSortOrder,
  nextPerfectMatchProductSortOrder,
  reorderPerfectMatchPairings,
  reorderPerfectMatchProducts,
  updatePerfectMatchPairing,
  updatePerfectMatchProduct,
  upsertPerfectMatchSetting,
} from "@/repositories/perfect-match.repository";

const SKU_PREFIX = "perfect-match-repo-test-product-";
let sequence = 0;

async function makeProduct() {
  sequence += 1;
  return prisma.product.create({
    data: { sku: `${SKU_PREFIX}${sequence}`, slug: `${SKU_PREFIX}${sequence}`, name: `Perfect Match Repo Test Product ${sequence}`, status: "Published" },
  });
}

async function makePerfectMatchProduct(overrides: Partial<Parameters<typeof createPerfectMatchProduct>[0]> = {}) {
  const product = await makeProduct();
  const sortOrder = await nextPerfectMatchProductSortOrder();
  return createPerfectMatchProduct({ product: { connect: { id: product.id } }, sortOrder, ...overrides });
}

afterEach(async () => {
  await prisma.perfectMatchPairing.deleteMany({ where: { perfectMatchProduct: { product: { sku: { startsWith: SKU_PREFIX } } } } });
  await prisma.perfectMatchProduct.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.perfectMatchSetting.deleteMany();
});

describe("PerfectMatchSetting", () => {
  it("upserts and reads back the singleton row", async () => {
    await upsertPerfectMatchSetting({ eyebrow: "A little inspiration", heading: "Ordinary Meals. Extraordinary Flavours." });
    const setting = await getPerfectMatchSetting();
    expect(setting?.id).toBe("global");
    expect(setting?.heading).toBe("Ordinary Meals. Extraordinary Flavours.");
  });
});

describe("createPerfectMatchProduct / nextPerfectMatchProductSortOrder", () => {
  it("assigns increasing sortOrder values", async () => {
    const first = await makePerfectMatchProduct();
    const second = await makePerfectMatchProduct();
    expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
  });

  it("rejects linking the same product twice (productId is unique)", async () => {
    const product = await makeProduct();
    await createPerfectMatchProduct({ product: { connect: { id: product.id } }, sortOrder: 0 });
    await expect(createPerfectMatchProduct({ product: { connect: { id: product.id } }, sortOrder: 1 })).rejects.toThrow();
  });
});

describe("updatePerfectMatchProduct / clearOtherDefaultFeaturedProducts", () => {
  it("updates fields and lets exactly one product be the default-featured one", async () => {
    const a = await makePerfectMatchProduct({ isDefaultFeatured: true });
    const b = await makePerfectMatchProduct();

    await clearOtherDefaultFeaturedProducts(b.id);
    await updatePerfectMatchProduct(b.id, { isDefaultFeatured: true, kicker: "A traditional favourite" });

    const refreshedA = await findPerfectMatchProductByProductId(a.productId);
    const refreshedB = await findPerfectMatchProductByProductId(b.productId);
    expect(refreshedA?.isDefaultFeatured).toBe(false);
    expect(refreshedB?.isDefaultFeatured).toBe(true);
    expect(refreshedB?.kicker).toBe("A traditional favourite");
  });
});

describe("deletePerfectMatchProductById", () => {
  it("removes the row", async () => {
    const created = await makePerfectMatchProduct();
    await deletePerfectMatchProductById(created.id);
    await expect(prisma.perfectMatchProduct.findUniqueOrThrow({ where: { id: created.id } })).rejects.toThrow();
  });
});

describe("reorderPerfectMatchProducts", () => {
  it("sets sortOrder to match the given id order", async () => {
    const first = await makePerfectMatchProduct();
    const second = await makePerfectMatchProduct();
    const third = await makePerfectMatchProduct();

    await reorderPerfectMatchProducts([third.id, first.id, second.id]);

    const rows = await prisma.perfectMatchProduct.findMany({ where: { id: { in: [first.id, second.id, third.id] } }, select: { id: true, sortOrder: true } });
    const sortOrderById = new Map(rows.map((r) => [r.id, r.sortOrder]));
    expect(sortOrderById.get(third.id)).toBe(0);
    expect(sortOrderById.get(first.id)).toBe(1);
    expect(sortOrderById.get(second.id)).toBe(2);
  });
});

describe("listPublishedPerfectMatchProducts", () => {
  it("only returns Published rows, default-featured first", async () => {
    const draft = await makePerfectMatchProduct({ status: "Draft" });
    const published = await makePerfectMatchProduct({ status: "Published" });
    const defaultFeatured = await makePerfectMatchProduct({ status: "Published", isDefaultFeatured: true, sortOrder: 999 });

    const rows = await listPublishedPerfectMatchProducts();
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).toContain(published.id);
    expect(ids[0]).toBe(defaultFeatured.id);
  });
});

describe("pairings", () => {
  it("creates, lists, updates, reorders, counts published, and deletes pairings for a product", async () => {
    const product = await makePerfectMatchProduct();

    const sortOrder0 = await nextPerfectMatchPairingSortOrder(product.id);
    const first = await createPerfectMatchPairing({
      perfectMatchProduct: { connect: { id: product.id } },
      title: "Sri Lankan Rotti",
      imageUrl: "/images/rotti.webp",
      sortOrder: sortOrder0,
      status: "Published",
    });
    const sortOrder1 = await nextPerfectMatchPairingSortOrder(product.id);
    expect(sortOrder1).toBeGreaterThan(sortOrder0);
    const second = await createPerfectMatchPairing({
      perfectMatchProduct: { connect: { id: product.id } },
      title: "Fresh Bread",
      imageUrl: "/images/bread.webp",
      sortOrder: sortOrder1,
      status: "Draft",
    });

    expect((await listPerfectMatchPairingsByProduct(product.id)).map((p) => p.id)).toEqual([first.id, second.id]);
    expect((await listPublishedPerfectMatchPairingsByProduct(product.id)).map((p) => p.id)).toEqual([first.id]);
    expect(await countPublishedPerfectMatchPairings(product.id)).toBe(1);

    const updated = await updatePerfectMatchPairing(second.id, { status: "Published", supportingTag: "Easy everyday idea" });
    expect(updated.status).toBe("Published");
    expect(updated.supportingTag).toBe("Easy everyday idea");
    expect(await countPublishedPerfectMatchPairings(product.id)).toBe(2);

    await reorderPerfectMatchPairings([second.id, first.id]);
    const reordered = await prisma.perfectMatchPairing.findMany({ where: { id: { in: [first.id, second.id] } }, select: { id: true, sortOrder: true } });
    const sortOrderById = new Map(reordered.map((r) => [r.id, r.sortOrder]));
    expect(sortOrderById.get(second.id)).toBe(0);
    expect(sortOrderById.get(first.id)).toBe(1);

    await deletePerfectMatchPairingById(first.id);
    expect((await listPerfectMatchPairingsByProduct(product.id)).map((p) => p.id)).toEqual([second.id]);
  });

  it("cascades: deleting the product deletes its pairings", async () => {
    const product = await makePerfectMatchProduct();
    await createPerfectMatchPairing({
      perfectMatchProduct: { connect: { id: product.id } },
      title: "Steamed Rice",
      imageUrl: "/images/rice.webp",
      sortOrder: 0,
    });

    await deletePerfectMatchProductById(product.id);
    expect(await prisma.perfectMatchPairing.count({ where: { perfectMatchProductId: product.id } })).toBe(0);
  });
});
