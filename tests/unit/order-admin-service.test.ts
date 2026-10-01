// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { createOrder } from "@/services/order.service";
import {
  IllegalOrderTransitionError,
  OrderHasNoPaymentError,
  OrderNotFoundError,
  OrderRefundAmountExceedsRemainingError,
} from "@/services/order.errors";
import {
  bulkChangeOrderStatus,
  changeOrderStatus,
  getOrderAdminDetail,
  listOrdersForAdmin,
  processReturn,
  refundOrder,
} from "@/services/order-admin.service";
import { PermissionDeniedError } from "@/services/permission.errors";

const EMAIL_DOMAIN = "@order-admin-svc-test.test";
const ROLE_KEY_PREFIX = "order-admin-svc-test-role-";
const SKU_PREFIX = "ORD-ADM-SKU-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Order Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "Orders", action: "View" },
    { module: "Orders", action: "Edit" },
    { module: "Orders", action: "Approve" },
  ]);
  return makeAdminUser(role.id);
}

async function makeEditOnlyAdmin() {
  const role = await makeRole([
    { module: "Orders", action: "View" },
    { module: "Orders", action: "Edit" },
  ]);
  return makeAdminUser(role.id);
}

async function makeViewOnlyAdmin() {
  const role = await makeRole([{ module: "Orders", action: "View" }]);
  return makeAdminUser(role.id);
}

async function makeProduct(stockQuantity: number) {
  sequence += 1;
  return prisma.product.create({ data: { sku: `${SKU_PREFIX}${sequence}`, slug: `${SKU_PREFIX}${sequence}`, name: `Order Admin Test Product ${sequence}`, status: "Published", stockQuantity } });
}

async function makePayment(amount: string) {
  sequence += 1;
  return prisma.payment.create({ data: { provider: "mock", providerReference: `mock_ord-adm-${sequence}`, status: "Succeeded", amount, currency: "LKR" } });
}

async function makeCart() {
  sequence += 1;
  return prisma.cart.create({ data: { guestToken: `ord-adm-cart-token-${sequence}` } });
}

/** A real Confirmed order with one line item and a Succeeded payment — createOrder's actual output, not a hand-rolled fixture. */
async function makeConfirmedOrder(options: { stock?: number; quantity?: number; amount?: string } = {}) {
  const stock = options.stock ?? 10;
  const quantity = options.quantity ?? 2;
  const amount = options.amount ?? "150.00";
  const product = await makeProduct(stock);
  const payment = await makePayment(amount);
  const cart = await makeCart();
  const { order } = await createOrder({
    userId: null,
    guestToken: "ord-adm-guest",
    guestEmail: "guest@order-admin-svc-test.test",
    idempotencyKey: crypto.randomUUID(),
    paymentId: payment.id,
    cartId: cart.id,
    subtotal: "100.00",
    deliveryCharge: "50.00",
    discount: "0.00",
    couponCode: null,
    discountLabel: null,
    couponRedemption: null,
    pointsRedeemed: 0,
    pointsRedemptionValue: "0.00",
    pointsRedemption: null,
    grandTotal: amount,
    rewardPointsEarned: 10,
    deliveryZoneName: "Western",
    estimatedDaysMin: 1,
    estimatedDaysMax: 3,
    shipRecipientName: "Test Guest",
    shipPhone: "+94 77 123 4567",
    shipLine1: "10 Test Lane",
    shipLine2: null,
    shipCity: "Colombo",
    shipDistrict: null,
    shipPostalCode: null,
    items: [{ productId: product.id, productName: product.name, productSku: product.sku, unitPrice: "50.00", quantity, lineTotal: (50 * quantity).toFixed(2), rewardPointsEarned: quantity }],
  });
  return { order, product, payment };
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.refundRecord.deleteMany({ where: { order: { guestEmail: "guest@order-admin-svc-test.test" } } });
  await prisma.returnRequest.deleteMany({ where: { order: { guestEmail: "guest@order-admin-svc-test.test" } } });
  await prisma.orderStatusHistory.deleteMany({ where: { order: { guestEmail: "guest@order-admin-svc-test.test" } } });
  await prisma.orderItem.deleteMany({ where: { order: { guestEmail: "guest@order-admin-svc-test.test" } } });
  await prisma.order.deleteMany({ where: { guestEmail: "guest@order-admin-svc-test.test" } });
  await prisma.payment.deleteMany({ where: { providerReference: { startsWith: "mock_ord-adm-" } } });
  await prisma.cart.deleteMany({ where: { guestToken: { startsWith: "ord-adm-cart-token-" } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("order-admin.service — list/detail", () => {
  it("lists orders and returns an admin detail with nextLegalStatuses from the real state machine", async () => {
    const admin = await makeFullAccessAdmin();
    const { order } = await makeConfirmedOrder();

    const list = await listOrdersForAdmin(admin.id, {}, 1, 20);
    expect(list.items.some((item) => item.id === order.id)).toBe(true);

    const detail = await getOrderAdminDetail(admin.id, order.id);
    expect(detail.orderNumber).toBe(order.orderNumber);
    expect(detail.nextLegalStatuses).toEqual(expect.arrayContaining(["Processing", "Cancelled"]));
  });

  it("throws OrderNotFoundError for an unknown id", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(getOrderAdminDetail(admin.id, "missing-id")).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it("denies a caller with no Orders permission", async () => {
    sequence += 1;
    const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}none-${sequence}`, name: "No Access" } });
    const noAccess = await makeAdminUser(role.id);
    const { order } = await makeConfirmedOrder();
    await expect(getOrderAdminDetail(noAccess.id, order.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("order-admin.service — status transitions", () => {
  it("changes status along the real pipeline and writes an audit log", async () => {
    const admin = await makeFullAccessAdmin();
    const { order } = await makeConfirmedOrder();

    const updated = await changeOrderStatus(admin.id, order.id, "Processing");
    expect(updated.status).toBe("Processing");

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "order_status_changed" } });
    expect(log).not.toBeNull();
  });

  it("rejects an illegal transition", async () => {
    const admin = await makeFullAccessAdmin();
    const { order } = await makeConfirmedOrder();
    await expect(changeOrderStatus(admin.id, order.id, "Delivered")).rejects.toBeInstanceOf(IllegalOrderTransitionError);
  });

  it("an Edit-level admin can change status; a View-only admin cannot", async () => {
    const editor = await makeEditOnlyAdmin();
    const { order: order1 } = await makeConfirmedOrder();
    await expect(changeOrderStatus(editor.id, order1.id, "Processing")).resolves.toMatchObject({ status: "Processing" });

    const viewer = await makeViewOnlyAdmin();
    const { order: order2 } = await makeConfirmedOrder();
    await expect(changeOrderStatus(viewer.id, order2.id, "Processing")).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("bulk status change updates the legal targets and skips the illegal one", async () => {
    const admin = await makeFullAccessAdmin();
    const { order: confirmed } = await makeConfirmedOrder();
    const { order: alsoConfirmed } = await makeConfirmedOrder();
    // Move one further along so "Processing" is no longer legal for it (Processing -> Processing isn't a listed transition).
    await changeOrderStatus(admin.id, alsoConfirmed.id, "Processing");
    await changeOrderStatus(admin.id, alsoConfirmed.id, "Dispatched");

    const result = await bulkChangeOrderStatus(admin.id, [confirmed.id, alsoConfirmed.id], "Processing");
    expect(result.updated).toEqual([confirmed.id]);
    expect(result.skipped).toEqual([alsoConfirmed.id]);
  });
});

describe("order-admin.service — refund", () => {
  it("issues a refund within the remaining balance and records it", async () => {
    const admin = await makeFullAccessAdmin();
    const { order } = await makeConfirmedOrder({ amount: "150.00" });

    const record = await refundOrder(admin.id, order.id, 50, "Damaged on arrival");
    expect(record.amount.toNumber()).toBe(50);

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "order_refunded" } });
    expect(log).not.toBeNull();
  });

  it("rejects a refund amount exceeding the remaining refundable balance", async () => {
    const admin = await makeFullAccessAdmin();
    const { order } = await makeConfirmedOrder({ amount: "150.00" });
    await expect(refundOrder(admin.id, order.id, 200, "Too much")).rejects.toBeInstanceOf(OrderRefundAmountExceedsRemainingError);
  });

  it("requires Approve, not just Edit", async () => {
    const editor = await makeEditOnlyAdmin();
    const { order } = await makeConfirmedOrder();
    await expect(refundOrder(editor.id, order.id, 10, "x")).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("throws OrderHasNoPaymentError when the order has no linked payment", async () => {
    const admin = await makeFullAccessAdmin();
    const { order } = await makeConfirmedOrder();
    await prisma.order.update({ where: { id: order.id }, data: { paymentId: null } });
    await expect(refundOrder(admin.id, order.id, 10, "x")).rejects.toBeInstanceOf(OrderHasNoPaymentError);
  });
});

describe("order-admin.service — return/RMA", () => {
  async function toDelivered(adminId: string, orderId: string) {
    await changeOrderStatus(adminId, orderId, "Processing");
    await changeOrderStatus(adminId, orderId, "Dispatched");
    return changeOrderStatus(adminId, orderId, "Delivered");
  }

  it("admin-initiated return (no prior request): restocks and transitions the order to Returned", async () => {
    const admin = await makeFullAccessAdmin();
    const { order, product } = await makeConfirmedOrder({ stock: 10, quantity: 2 });
    await toDelivered(admin.id, order.id);

    const detail = await getOrderAdminDetail(admin.id, order.id);
    const line = detail.items[0];

    const result = await processReturn(admin.id, order.id, {
      items: [{ orderItemId: line.orderItemId, productName: line.productName, quantity: line.quantity }],
      reasonCode: "Damaged",
      restocked: true,
    });
    expect(result.status).toBe("Completed");
    expect(result.restocked).toBe(true);

    const refreshedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshedOrder.status).toBe("Returned");

    const refreshedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(refreshedProduct.stockQuantity).toBe(10); // was decremented to 8 on createOrder, restocked by 2 here
  });

  it("completes an existing customer-submitted Requested return instead of creating a second one", async () => {
    const admin = await makeFullAccessAdmin();
    const { order } = await makeConfirmedOrder({ stock: 10, quantity: 1 });
    await toDelivered(admin.id, order.id);
    const detail = await getOrderAdminDetail(admin.id, order.id);
    const line = detail.items[0];

    await prisma.returnRequest.create({
      data: { orderId: order.id, reason: "Customer says it's damaged.", items: [{ orderItemId: line.orderItemId, productName: line.productName, quantity: line.quantity }] },
    });

    await processReturn(admin.id, order.id, {
      items: [{ orderItemId: line.orderItemId, productName: line.productName, quantity: line.quantity }],
      reasonCode: "Damaged",
      restocked: false,
    });

    const requests = await prisma.returnRequest.findMany({ where: { orderId: order.id } });
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe("Completed");
    expect(requests[0].processedById).toBe(admin.id);
  });

  it("requires Approve, not just Edit", async () => {
    const editor = await makeEditOnlyAdmin();
    const { order } = await makeConfirmedOrder();
    await expect(processReturn(editor.id, order.id, { items: [], reasonCode: "Other", restocked: false })).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
