// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { getPerfectMatchForStorefront } from "@/services/perfect-match.service";
import { addPerfectMatchPairing, addPerfectMatchProduct, updatePerfectMatchProductAdmin, updatePerfectMatchSettingForAdmin } from "@/services/perfect-match-admin.service";

const EMAIL_DOMAIN = "@perfect-match-svc-test.test";
const ROLE_KEY_PREFIX = "perfect-match-svc-test-role-";
const SKU_PREFIX = "perfect-match-svc-test-product-";
let sequence = 0;

async function makeFullAccessAdmin() {
  sequence += 1;
  const role = await prisma.role.create({
    data: {
      key: `${ROLE_KEY_PREFIX}${sequence}`,
      name: `Perfect Match Svc Test Role ${sequence}`,
      permissions: { create: [{ module: "PerfectMatch", action: "View" }, { module: "PerfectMatch", action: "Edit" }] },
    },
  });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeProduct(overrides: { status?: "Draft" | "Published"; shortDescription?: string | null } = {}) {
  sequence += 1;
  return prisma.product.create({
    data: {
      sku: `${SKU_PREFIX}${sequence}`,
      slug: `${SKU_PREFIX}${sequence}`,
      name: `Perfect Match Svc Test Product ${sequence}`,
      status: overrides.status ?? "Published",
      shortDescription: overrides.shortDescription,
    },
  });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.perfectMatchPairing.deleteMany({ where: { perfectMatchProduct: { product: { sku: { startsWith: SKU_PREFIX } } } } });
  await prisma.perfectMatchProduct.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.perfectMatchSetting.deleteMany({ where: { id: "global" } });
});

describe("perfect-match.service — getPerfectMatchForStorefront", () => {
  it("falls back to perfectMatchDefaults for intro copy and returns no products when nothing is published", async () => {
    const data = await getPerfectMatchForStorefront();
    expect(data.heading).toBe("Ordinary Meals. Extraordinary Flavours.");
    expect(data.products).toEqual([]);
  });

  it("prefers a real PerfectMatchSetting field while still falling back for unset fields", async () => {
    const admin = await makeFullAccessAdmin();
    await updatePerfectMatchSettingForAdmin(admin.id, { eyebrow: "Custom Eyebrow", heading: null, description: null });

    const data = await getPerfectMatchForStorefront();
    expect(data.eyebrow).toBe("Custom Eyebrow");
    expect(data.heading).toBe("Ordinary Meals. Extraordinary Flavours.");
  });

  it("omits a Draft product link from the storefront result", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    await addPerfectMatchProduct(admin.id, { productId: product.id, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false });

    const data = await getPerfectMatchForStorefront();
    expect(data.products).toEqual([]);
  });

  it("omits a Published link whose underlying catalogue product is no longer Published", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct({ status: "Draft" });
    const link = await addPerfectMatchProduct(admin.id, { productId: product.id, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false });
    await updatePerfectMatchProductAdmin(admin.id, link.id, { productId: product.id, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false, status: "Published" });

    const data = await getPerfectMatchForStorefront();
    expect(data.products).toEqual([]);
  });

  it("falls back to the product's own shortDescription when no promoDescriptionOverride is set", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct({ shortDescription: "The product's real short description." });
    const link = await addPerfectMatchProduct(admin.id, { productId: product.id, kicker: "A traditional favourite", promoDescriptionOverride: null, isDefaultFeatured: false });
    await updatePerfectMatchProductAdmin(admin.id, link.id, { productId: product.id, kicker: "A traditional favourite", promoDescriptionOverride: null, isDefaultFeatured: false, status: "Published" });

    const data = await getPerfectMatchForStorefront();
    expect(data.products).toHaveLength(1);
    expect(data.products[0].description).toBe("The product's real short description.");
    expect(data.products[0].kicker).toBe("A traditional favourite");
  });

  it("orders products default-featured first, then by sortOrder, and only includes Published pairings up to 4", async () => {
    const admin = await makeFullAccessAdmin();
    const first = await makeProduct();
    const second = await makeProduct();

    const firstLink = await addPerfectMatchProduct(admin.id, { productId: first.id, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false });
    await updatePerfectMatchProductAdmin(admin.id, firstLink.id, { productId: first.id, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false, status: "Published" });

    const secondLink = await addPerfectMatchProduct(admin.id, { productId: second.id, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: true });
    await updatePerfectMatchProductAdmin(admin.id, secondLink.id, { productId: second.id, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: true, status: "Published" });

    for (let i = 1; i <= 5; i += 1) {
      const status = i <= 4 ? "Published" : "Draft";
      await addPerfectMatchPairing(admin.id, secondLink.id, {
        title: `Pairing ${i}`,
        description: null,
        imageUrl: "/images/pairing.webp",
        imageAlt: null,
        categoryLabel: null,
        supportingTag: null,
        status,
      });
    }

    const data = await getPerfectMatchForStorefront();
    expect(data.products.map((product) => product.id)).toEqual([secondLink.id, firstLink.id]);
    expect(data.products[0].pairings).toHaveLength(4);
    expect(data.products[0].pairings.every((pairing) => pairing.title.startsWith("Pairing"))).toBe(true);
    expect(data.products[1].pairings).toEqual([]);
  });
});
