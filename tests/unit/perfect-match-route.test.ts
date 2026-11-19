// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/admin-auth", () => ({ adminAuth: vi.fn() }));

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const { adminAuth } = await import("@/lib/admin-auth");
const { GET: getSettings, PUT: putSettings } = await import("@/app/api/admin/perfect-match/settings/route");
const { GET: listProducts, POST: postProduct } = await import("@/app/api/admin/perfect-match/products/route");
const { PATCH: patchProduct, DELETE: deleteProduct } = await import("@/app/api/admin/perfect-match/products/[id]/route");
const { PATCH: reorderProducts } = await import("@/app/api/admin/perfect-match/products/reorder/route");
const { GET: listPairings, POST: postPairing } = await import("@/app/api/admin/perfect-match/products/[id]/pairings/route");
const { PATCH: patchPairing, DELETE: deletePairing } = await import("@/app/api/admin/perfect-match/pairings/[id]/route");
const { PATCH: reorderPairings } = await import("@/app/api/admin/perfect-match/products/[id]/pairings/reorder/route");
const mockAdminAuth = adminAuth as unknown as Mock<() => Promise<Session | null>>;

const EMAIL_DOMAIN = "@perfect-match-route-test.test";
const ROLE_KEY_PREFIX = "perfect-match-route-test-role-";
const SKU_PREFIX = "perfect-match-route-test-product-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Perfect Match Route Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function sessionFor(adminId: string) {
  return { user: { id: adminId }, expires: new Date(Date.now() + 60_000).toISOString() };
}

function fullAccessAdmin() {
  return makeAdmin([
    { module: "PerfectMatch", action: "View" },
    { module: "PerfectMatch", action: "Edit" },
    { module: "PerfectMatch", action: "Delete" },
  ]);
}

async function makeProduct() {
  sequence += 1;
  return prisma.product.create({
    data: { sku: `${SKU_PREFIX}${sequence}`, slug: `${SKU_PREFIX}${sequence}`, name: `Perfect Match Route Test Product ${sequence}`, status: "Published" },
  });
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.perfectMatchPairing.deleteMany({ where: { perfectMatchProduct: { product: { sku: { startsWith: SKU_PREFIX } } } } });
  await prisma.perfectMatchProduct.deleteMany({ where: { product: { sku: { startsWith: SKU_PREFIX } } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  vi.clearAllMocks();
});

describe("GET/PUT /api/admin/perfect-match/settings", () => {
  it("returns 401 with no session", async () => {
    mockAdminAuth.mockResolvedValue(null);
    expect((await getSettings()).status).toBe(401);
  });

  it("returns 403 for an admin without PerfectMatch:View", async () => {
    const stranger = await makeAdmin([]);
    mockAdminAuth.mockResolvedValue(sessionFor(stranger.id));
    expect((await getSettings()).status).toBe(403);
  });

  it("returns 200 for GET and PUT with permission", async () => {
    const admin = await fullAccessAdmin();
    mockAdminAuth.mockResolvedValue(sessionFor(admin.id));
    expect((await getSettings()).status).toBe(200);
    const putResponse = await putSettings(jsonRequest("http://localhost/api/admin/perfect-match/settings", "PUT", { eyebrow: "A little inspiration", heading: "Ordinary Meals.", description: "" }));
    expect(putResponse.status).toBe(200);
  });
});

describe("GET/POST /api/admin/perfect-match/products", () => {
  it("returns 201 for a valid POST with permission, and 400 for an invalid body", async () => {
    const admin = await fullAccessAdmin();
    mockAdminAuth.mockResolvedValue(sessionFor(admin.id));
    const product = await makeProduct();

    const created = await postProduct(jsonRequest("http://localhost/api/admin/perfect-match/products", "POST", { productId: product.id, kicker: "", promoDescriptionOverride: "" }));
    expect(created.status).toBe(201);

    const invalid = await postProduct(jsonRequest("http://localhost/api/admin/perfect-match/products", "POST", { productId: "" }));
    expect(invalid.status).toBe(400);

    expect((await listProducts()).status).toBe(200);
  });
});

describe("/api/admin/perfect-match/products/[id] and pairings", () => {
  it("supports the full product + pairing lifecycle through the route handlers", async () => {
    const admin = await fullAccessAdmin();
    mockAdminAuth.mockResolvedValue(sessionFor(admin.id));
    const product = await makeProduct();

    const createdResponse = await postProduct(jsonRequest("http://localhost/api/admin/perfect-match/products", "POST", { productId: product.id, kicker: null, promoDescriptionOverride: null }));
    const created = await createdResponse.json();

    const patched = await patchProduct(jsonRequest(`http://localhost/api/admin/perfect-match/products/${created.id}`, "PATCH", { productId: product.id, kicker: "Updated", promoDescriptionOverride: null, isDefaultFeatured: true }), {
      params: Promise.resolve({ id: created.id }),
    });
    expect(patched.status).toBe(200);

    const pairingCreated = await postPairing(
      jsonRequest(`http://localhost/api/admin/perfect-match/products/${created.id}/pairings`, "POST", { title: "Sri Lankan Rotti", description: null, imageUrl: "/images/rotti.webp", imageAlt: null, categoryLabel: null, supportingTag: null, status: "Draft" }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(pairingCreated.status).toBe(201);
    const pairing = await pairingCreated.json();

    expect((await listPairings(new Request("http://localhost"), { params: Promise.resolve({ id: created.id }) })).status).toBe(200);

    const pairingPatched = await patchPairing(
      jsonRequest(`http://localhost/api/admin/perfect-match/pairings/${pairing.id}`, "PATCH", { title: "Sri Lankan Rotti (updated)", description: null, imageUrl: "/images/rotti.webp", imageAlt: null, categoryLabel: null, supportingTag: null, status: "Draft" }),
      { params: Promise.resolve({ id: pairing.id }) },
    );
    expect(pairingPatched.status).toBe(200);

    const reorderPairingsResponse = await reorderPairings(jsonRequest(`http://localhost/api/admin/perfect-match/products/${created.id}/pairings/reorder`, "PATCH", { orderedIds: [pairing.id] }), {
      params: Promise.resolve({ id: created.id }),
    });
    expect(reorderPairingsResponse.status).toBe(200);

    expect((await deletePairing(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ id: pairing.id }) })).status).toBe(200);

    const reorderProductsResponse = await reorderProducts(jsonRequest("http://localhost/api/admin/perfect-match/products/reorder", "PATCH", { orderedIds: [created.id] }));
    expect(reorderProductsResponse.status).toBe(200);

    expect((await deleteProduct(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({ id: created.id }) })).status).toBe(200);
  });
});
