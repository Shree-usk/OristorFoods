import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/db";

import { signInAs } from "./helpers/auth";

const EMAIL_DOMAIN = "@e2e-order-history-support.test";
const SKU_PREFIX = "E2E-ORD-HIST-SKU-";

async function makeProduct(sequence: number) {
  return prisma.product.create({
    data: {
      sku: `${SKU_PREFIX}${sequence}`,
      slug: `e2e-order-hist-product-${sequence}`,
      name: `E2E Order History Product ${sequence}`,
      status: "Published",
      inStock: true,
      stockQuantity: 10,
    },
  });
}

async function makeOrder(userId: string, orderNumber: string, status: "Confirmed" | "Delivered" | "Dispatched", productId: string) {
  return prisma.order.create({
    data: {
      orderNumber,
      idempotencyKey: `e2e-idem-${orderNumber}`,
      userId,
      status,
      subtotal: "50.00",
      deliveryCharge: "0.00",
      grandTotal: "50.00",
      deliveryZoneName: "Western",
      shipRecipientName: "E2E Customer",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipCity: "Colombo",
      carrier: status === "Dispatched" ? "Test Courier" : null,
      trackingNumber: status === "Dispatched" ? "TRACK123" : null,
      statusHistory: { create: [{ status, actor: "system:test" }] },
      items: {
        create: [{ productId, productName: "E2E Product", productSku: "SKU-1", unitPrice: "50.00", quantity: 1, lineTotal: "50.00" }],
      },
    },
  });
}

test.describe("Order History & Support (STORY-036)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.returnRequest.deleteMany({ where: { order: { user: { email: { endsWith: EMAIL_DOMAIN } } } } });
    await prisma.supportTicket.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.orderStatusHistory.deleteMany({ where: { order: { user: { email: { endsWith: EMAIL_DOMAIN } } } } });
    await prisma.orderItem.deleteMany({ where: { order: { user: { email: { endsWith: EMAIL_DOMAIN } } } } });
    await prisma.order.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.cartItem.deleteMany({ where: { cart: { user: { email: { endsWith: EMAIL_DOMAIN } } } } });
    await prisma.cart.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("shows an empty state with no orders or support tickets", async ({ page }) => {
    const user = await prisma.user.create({ data: { email: `empty${EMAIL_DOMAIN}` } });
    await signInAs(page, user.id);

    await page.goto("/account/orders");
    await expect(page.getByText("No orders yet")).toBeVisible();

    await page.goto("/account/support");
    await expect(page.getByText("You haven't contacted support yet")).toBeVisible();
  });

  test("shows order detail with status timeline and tracking", async ({ page }) => {
    const user = await prisma.user.create({ data: { email: `detail${EMAIL_DOMAIN}` } });
    const product = await makeProduct(1);
    const order = await makeOrder(user.id, "ORS-E2E-DETAIL-1", "Dispatched", product.id);
    await signInAs(page, user.id);

    await page.goto("/account/orders");
    await expect(page.getByText(order.orderNumber)).toBeVisible();

    await page.getByRole("link", { name: order.orderNumber }).click();
    await expect(page.getByRole("heading", { name: order.orderNumber })).toBeVisible();
    await expect(page.getByText("Dispatched", { exact: true })).toBeVisible();
    await expect(page.getByText("TRACK123")).toBeVisible();
  });

  test("reorders a still-in-stock item into the cart", async ({ page }) => {
    const user = await prisma.user.create({ data: { email: `reorder${EMAIL_DOMAIN}` } });
    const product = await makeProduct(2);
    const order = await makeOrder(user.id, "ORS-E2E-REORDER-1", "Confirmed", product.id);
    await signInAs(page, user.id);

    await page.goto(`/account/orders/${order.orderNumber}`);
    await page.getByRole("button", { name: "Reorder" }).click();
    await expect(page.getByText(/Added 1 item/)).toBeVisible();
  });

  test("submits a return request from a delivered order", async ({ page }) => {
    const user = await prisma.user.create({ data: { email: `return${EMAIL_DOMAIN}` } });
    const product = await makeProduct(3);
    const order = await makeOrder(user.id, "ORS-E2E-RETURN-1", "Delivered", product.id);
    await signInAs(page, user.id);

    await page.goto(`/account/orders/${order.orderNumber}`);
    await page.getByRole("button", { name: "Request a return" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("E2E Product").check();
    await page.getByLabel("Reason").fill("Item arrived damaged.");
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByText("Return requested")).toBeVisible();

    const returnRequest = await prisma.returnRequest.findFirst({ where: { orderId: order.id } });
    expect(returnRequest?.reason).toBe("Item arrived damaged.");
  });

  test("submits a support ticket, with and without an order pre-fill", async ({ page }) => {
    const user = await prisma.user.create({ data: { email: `ticket${EMAIL_DOMAIN}` } });
    const product = await makeProduct(4);
    const order = await makeOrder(user.id, "ORS-E2E-TICKET-1", "Delivered", product.id);
    await signInAs(page, user.id);

    await page.goto(`/account/support?order=${order.orderNumber}`);
    await expect(page.getByText(`Regarding order ${order.orderNumber}`)).toBeVisible();
    await page.getByLabel("Subject").fill("Question about my order");
    await page.getByLabel("Message").fill("When will this arrive?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Question about my order")).toBeVisible();

    await page.goto("/account/support");
    await page.getByLabel("Subject").fill("General question");
    await page.getByLabel("Message").fill("Do you ship internationally?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("General question")).toBeVisible();
  });
});
