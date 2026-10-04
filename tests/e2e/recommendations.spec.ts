import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { recomputeProductAssociations } from "@/services/recommendation.service";

import { signInAs } from "./helpers/auth";

const SKU_PREFIX = "E2E-RECO-SKU-";
const ORDER_PREFIX = "E2E-RECO-ORDER-";
const EMAIL_DOMAIN = "@e2e-recommendations.test";
const ROLE_KEY = "e2e-recommendations-admin-role";

async function makeAdmin() {
  const role = await prisma.role.upsert({
    where: { key: ROLE_KEY },
    update: {},
    create: { key: ROLE_KEY, name: "E2E Recommendations Admin Role" },
  });
  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  await prisma.rolePermission.create({ data: { roleId: role.id, module: "Products", action: "Edit" } });
  return prisma.adminUser.upsert({
    where: { email: `admin${EMAIL_DOMAIN}` },
    update: { roleId: role.id },
    create: { email: `admin${EMAIL_DOMAIN}`, name: "E2E Reco Admin", passwordHash: "unused", roleId: role.id },
  });
}

async function makeOrder(n: string, items: { productId: string; productName: string; productSku: string }[]) {
  return prisma.order.create({
    data: {
      orderNumber: `${ORDER_PREFIX}${n}`,
      idempotencyKey: `idem-${ORDER_PREFIX}${n}`,
      status: "Confirmed",
      subtotal: (items.length * 100).toFixed(2),
      deliveryCharge: "0.00",
      grandTotal: (items.length * 100).toFixed(2),
      deliveryZoneName: "Western",
      shipRecipientName: "E2E Customer",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipCity: "Colombo",
      items: {
        create: items.map((item) => ({ productId: item.productId, productName: item.productName, productSku: item.productSku, unitPrice: "100.00", quantity: 1, lineTotal: "100.00" })),
      },
    },
  });
}

/** Role key/SKUs/order numbers/emails are all namespaced "e2e-recommendations" so this spec's rows never collide with another spec's fixtures under fullyParallel. */
test.describe("AI Product Recommendations (STORY-060)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.orderItem.deleteMany({ where: { order: { orderNumber: { startsWith: ORDER_PREFIX } } } });
    await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
    await prisma.productAssociation.deleteMany({ where: { sourceProduct: { sku: { startsWith: SKU_PREFIX } } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("homepage cold-start rail, PDP similar/frequently-bought-together, and cart cross-sell all render from real seeded data", async ({ page }) => {
    const productA = await createProduct({ sku: `${SKU_PREFIX}A`, slug: "e2e-reco-product-a", name: "E2E Reco Best Seller", status: "Published", stockQuantity: 50 });
    await createStandardPrice({ product: { connect: { id: productA.id } }, price: "850.00" });
    const productB = await createProduct({ sku: `${SKU_PREFIX}B`, slug: "e2e-reco-product-b", name: "E2E Reco Frequently Paired", status: "Published", stockQuantity: 50 });
    await createStandardPrice({ product: { connect: { id: productB.id } }, price: "450.00" });

    // Two real orders pairing A+B — the FrequentlyBoughtTogether signal.
    await makeOrder("1", [{ productId: productA.id, productName: productA.name, productSku: productA.sku }, { productId: productB.id, productName: productB.name, productSku: productB.sku }]);
    await makeOrder("2", [{ productId: productA.id, productName: productA.name, productSku: productA.sku }, { productId: productB.id, productName: productB.name, productSku: productB.sku }]);
    // A third, standalone order gives productA the stronger best-seller signal for the homepage cold-start rail.
    await makeOrder("3", [{ productId: productA.id, productName: productA.name, productSku: productA.sku }]);

    const admin = await makeAdmin();
    await recomputeProductAssociations(admin.id);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Best Selling Products" })).toBeVisible();
    await expect(page.getByText("E2E Reco Best Seller")).toBeVisible();

    await page.goto(`/products/${productA.slug}`);
    await expect(page.getByRole("heading", { name: "Frequently Bought Together" })).toBeVisible();
    await expect(page.getByText("E2E Reco Frequently Paired")).toBeVisible();

    await page.getByText("E2E Reco Frequently Paired").click();
    await expect(page).toHaveURL(new RegExp(`/products/${productB.slug}$`));

    const user = await prisma.user.create({ data: { email: `customer${EMAIL_DOMAIN}` } });
    await signInAs(page, user.id);
    await page.goto(`/products/${productA.slug}`);
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "You May Also Need" })).toBeVisible();
    await expect(page.getByText("E2E Reco Frequently Paired")).toBeVisible();
  });

  test("the homepage recommendation rail has no detectable accessibility violations", async ({ page }) => {
    const product = await createProduct({ sku: `${SKU_PREFIX}C`, slug: "e2e-reco-a11y-product", name: "E2E Reco A11y Product", status: "Published", stockQuantity: 10 });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await makeOrder("4", [{ productId: product.id, productName: product.name, productSku: product.sku }]);

    await page.goto("/");
    await expect(page.getByText("E2E Reco A11y Product")).toBeVisible();

    const { default: AxeBuilder } = await import("@axe-core/playwright");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
