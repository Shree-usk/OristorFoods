// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  PerfectMatchPairingLimitExceededError,
  PerfectMatchPairingNotFoundError,
  PerfectMatchProductAlreadyAddedError,
  PerfectMatchProductNotFoundError,
  PerfectMatchUnderlyingProductNotFoundError,
} from "@/services/perfect-match-admin.errors";
import {
  addPerfectMatchPairing,
  addPerfectMatchProduct,
  removePerfectMatchPairing,
  removePerfectMatchProduct,
  reorderPerfectMatchPairingsAdmin,
  reorderPerfectMatchProductsAdmin,
  updatePerfectMatchPairingAdmin,
  updatePerfectMatchProductAdmin,
} from "@/services/perfect-match-admin.service";
import type { PerfectMatchPairingAdminInput } from "@/validation/perfect-match-admin.schema";

const EMAIL_DOMAIN = "@perfect-match-admin-svc-test.test";
const ROLE_KEY_PREFIX = "perfect-match-admin-svc-test-role-";
const SKU_PREFIX = "perfect-match-admin-svc-test-product-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Perfect Match Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "PerfectMatch", action: "View" },
    { module: "PerfectMatch", action: "Edit" },
    { module: "PerfectMatch", action: "Delete" },
  ]);
  return makeAdminUser(role.id);
}

async function makeViewOnlyAdmin() {
  const role = await makeRole([{ module: "PerfectMatch", action: "View" }]);
  return makeAdminUser(role.id);
}

async function makeProduct() {
  sequence += 1;
  return prisma.product.create({
    data: { sku: `${SKU_PREFIX}${sequence}`, slug: `${SKU_PREFIX}${sequence}`, name: `Perfect Match Admin Svc Test Product ${sequence}`, status: "Published" },
  });
}

function pairingInput(overrides: Partial<PerfectMatchPairingAdminInput> = {}): PerfectMatchPairingAdminInput {
  sequence += 1;
  return { title: `Pairing ${sequence}`, description: null, imageUrl: "/images/pairing.webp", imageAlt: null, categoryLabel: null, supportingTag: null, status: "Draft", ...overrides };
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.perfectMatchPairing.deleteMany({ where: { perfectMatchProduct: { product: { sku: { startsWith: SKU_PREFIX } } } } });
  await prisma.perfectMatchProduct.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
});

describe("perfect-match-admin.service — permissions", () => {
  it("denies adding a product without Edit permission", async () => {
    const viewer = await makeViewOnlyAdmin();
    const product = await makeProduct();
    await expect(addPerfectMatchProduct(viewer.id, { productId: product.id, tabLabel: null, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false })).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });
});

describe("perfect-match-admin.service — products", () => {
  it("adds a product, writes an audit log entry, and rejects linking the underlying product twice", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const linked = await addPerfectMatchProduct(admin.id, { productId: product.id, tabLabel: null, kicker: "A traditional favourite", promoDescriptionOverride: null, isDefaultFeatured: false });

    expect(linked.productId).toBe(product.id);
    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "perfect_match_product_added" } });
    expect(log).not.toBeNull();

    await expect(addPerfectMatchProduct(admin.id, { productId: product.id, tabLabel: null, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false })).rejects.toBeInstanceOf(
      PerfectMatchProductAlreadyAddedError,
    );
  });

  it("rejects linking a product id that doesn't exist in the catalogue", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(
      addPerfectMatchProduct(admin.id, { productId: "does-not-exist", tabLabel: null, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false }),
    ).rejects.toBeInstanceOf(PerfectMatchUnderlyingProductNotFoundError);
  });

  it("keeps exactly one default-featured product at a time, on both add and update", async () => {
    const admin = await makeFullAccessAdmin();
    const productA = await makeProduct();
    const productB = await makeProduct();
    const linkedA = await addPerfectMatchProduct(admin.id, { productId: productA.id, tabLabel: null, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: true });
    expect(linkedA.isDefaultFeatured).toBe(true);

    const linkedB = await addPerfectMatchProduct(admin.id, { productId: productB.id, tabLabel: null, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: true });
    expect(linkedB.isDefaultFeatured).toBe(true);

    const refreshedA = await prisma.perfectMatchProduct.findUniqueOrThrow({ where: { id: linkedA.id } });
    expect(refreshedA.isDefaultFeatured).toBe(false);

    await updatePerfectMatchProductAdmin(admin.id, linkedA.id, { productId: productA.id, tabLabel: null, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: true });
    const refreshedB = await prisma.perfectMatchProduct.findUniqueOrThrow({ where: { id: linkedB.id } });
    expect(refreshedB.isDefaultFeatured).toBe(false);
  });

  it("update rejects when the id doesn't exist", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(
      updatePerfectMatchProductAdmin(admin.id, "does-not-exist", { productId: "irrelevant", tabLabel: null, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false }),
    ).rejects.toBeInstanceOf(PerfectMatchProductNotFoundError);
  });

  it("removes a product and writes an audit log entry", async () => {
    const admin = await makeFullAccessAdmin();
    const product = await makeProduct();
    const linked = await addPerfectMatchProduct(admin.id, { productId: product.id, tabLabel: null, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false });

    await removePerfectMatchProduct(admin.id, linked.id);
    await expect(prisma.perfectMatchProduct.findUniqueOrThrow({ where: { id: linked.id } })).rejects.toThrow();
    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "perfect_match_product_removed" } });
    expect(log).not.toBeNull();
  });

  it("reorders products and writes an audit log entry", async () => {
    const admin = await makeFullAccessAdmin();
    const productA = await makeProduct();
    const productB = await makeProduct();
    const a = await addPerfectMatchProduct(admin.id, { productId: productA.id, tabLabel: null, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false });
    const b = await addPerfectMatchProduct(admin.id, { productId: productB.id, tabLabel: null, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false });

    await reorderPerfectMatchProductsAdmin(admin.id, [b.id, a.id]);

    const refreshedA = await prisma.perfectMatchProduct.findUniqueOrThrow({ where: { id: a.id } });
    const refreshedB = await prisma.perfectMatchProduct.findUniqueOrThrow({ where: { id: b.id } });
    expect(refreshedB.sortOrder).toBeLessThan(refreshedA.sortOrder);
    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "perfect_match_products_reordered" } });
    expect(log).not.toBeNull();
  });
});

describe("perfect-match-admin.service — pairings", () => {
  async function makeLinkedProduct(admin: { id: string }) {
    const product = await makeProduct();
    return addPerfectMatchProduct(admin.id, { productId: product.id, tabLabel: null, kicker: null, promoDescriptionOverride: null, isDefaultFeatured: false });
  }

  it("adds a Draft pairing without touching the published-count limit", async () => {
    const admin = await makeFullAccessAdmin();
    const linked = await makeLinkedProduct(admin);
    const pairing = await addPerfectMatchPairing(admin.id, linked.id, pairingInput({ status: "Draft" }));
    expect(pairing.status).toBe("Draft");
    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "perfect_match_pairing_added" } });
    expect(log).not.toBeNull();
  });

  it("rejects adding a pairing to a product that doesn't exist", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(addPerfectMatchPairing(admin.id, "does-not-exist", pairingInput())).rejects.toBeInstanceOf(PerfectMatchProductNotFoundError);
  });

  it("enforces at most 4 Published pairings per product, on both create and update", async () => {
    const admin = await makeFullAccessAdmin();
    const linked = await makeLinkedProduct(admin);

    for (let i = 0; i < 4; i += 1) {
      await addPerfectMatchPairing(admin.id, linked.id, pairingInput({ status: "Published" }));
    }

    await expect(addPerfectMatchPairing(admin.id, linked.id, pairingInput({ status: "Published" }))).rejects.toBeInstanceOf(PerfectMatchPairingLimitExceededError);

    const draft = await addPerfectMatchPairing(admin.id, linked.id, pairingInput({ status: "Draft" }));
    await expect(updatePerfectMatchPairingAdmin(admin.id, draft.id, pairingInput({ status: "Published" }))).rejects.toBeInstanceOf(PerfectMatchPairingLimitExceededError);
  });

  it("re-saving an already-Published pairing's copy (status still Published) doesn't double-count itself against the limit", async () => {
    const admin = await makeFullAccessAdmin();
    const linked = await makeLinkedProduct(admin);
    const pairings = [];
    for (let i = 0; i < 4; i += 1) {
      pairings.push(await addPerfectMatchPairing(admin.id, linked.id, pairingInput({ status: "Published" })));
    }

    const updated = await updatePerfectMatchPairingAdmin(admin.id, pairings[0].id, pairingInput({ title: "Updated title", status: "Published" }));
    expect(updated.title).toBe("Updated title");
    expect(updated.status).toBe("Published");
  });

  it("removes a pairing and writes an audit log entry", async () => {
    const admin = await makeFullAccessAdmin();
    const linked = await makeLinkedProduct(admin);
    const pairing = await addPerfectMatchPairing(admin.id, linked.id, pairingInput());

    await removePerfectMatchPairing(admin.id, pairing.id);
    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "perfect_match_pairing_removed" } });
    expect(log).not.toBeNull();
  });

  it("reorders a product's own pairings but rejects an id belonging to a different product", async () => {
    const admin = await makeFullAccessAdmin();
    const linkedA = await makeLinkedProduct(admin);
    const linkedB = await makeLinkedProduct(admin);
    const first = await addPerfectMatchPairing(admin.id, linkedA.id, pairingInput());
    const second = await addPerfectMatchPairing(admin.id, linkedA.id, pairingInput());
    const otherProductsPairing = await addPerfectMatchPairing(admin.id, linkedB.id, pairingInput());

    await reorderPerfectMatchPairingsAdmin(admin.id, linkedA.id, [second.id, first.id]);
    const refreshedFirst = await prisma.perfectMatchPairing.findUniqueOrThrow({ where: { id: first.id } });
    const refreshedSecond = await prisma.perfectMatchPairing.findUniqueOrThrow({ where: { id: second.id } });
    expect(refreshedSecond.sortOrder).toBeLessThan(refreshedFirst.sortOrder);

    await expect(reorderPerfectMatchPairingsAdmin(admin.id, linkedA.id, [otherProductsPairing.id])).rejects.toBeInstanceOf(PerfectMatchPairingNotFoundError);
  });
});
