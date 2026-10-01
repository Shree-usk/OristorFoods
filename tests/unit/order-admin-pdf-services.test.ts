// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { OrderAdminDetail } from "@/services/order-admin.service";
import { renderOrderPackingSlipPdf } from "@/services/packing-slip-pdf.service";
import { renderOrderShippingLabelPdf } from "@/services/shipping-label-pdf.service";

const FIXTURE_ORDER: OrderAdminDetail = {
  orderNumber: "ORS-20260101-ABCDEF",
  status: "Processing",
  placedAt: "2026-01-01T10:00:00.000Z",
  customerName: "Test Customer",
  customerEmail: "customer@test.com",
  shippingAddress: { recipientName: "Test Customer", phone: "+94 77 123 4567", line1: "10 Test Lane", city: "Colombo" },
  items: [
    { orderItemId: "item-1", productId: "product-1", productName: "Chilli Powder 200g", productSku: "SKU-001", unitPrice: 500, quantity: 2, lineTotal: 1000, imageUrl: null },
  ],
  subtotal: 1000,
  deliveryCharge: 300,
  discount: 0,
  discountLabel: null,
  couponCode: null,
  pointsRedeemed: 0,
  pointsRedemptionValue: 0,
  tax: 0,
  grandTotal: 1300,
  currency: "LKR",
  rewardPointsEarned: 10,
  deliveryZoneName: "Western",
  estimatedDaysMin: 1,
  estimatedDaysMax: 3,
  statusHistory: [{ status: "Confirmed", actor: "system:checkout", createdAt: "2026-01-01T10:00:00.000Z" }],
  tracking: { carrier: null, trackingNumber: null, trackingUrl: null },
  payment: { provider: "mock", status: "Succeeded", amount: 1300, currency: "LKR" },
  cancelledAt: null,
  cancellationReason: null,
  refundRecords: [],
  returnRequests: [],
  nextLegalStatuses: ["Dispatched", "Cancelled"],
};

describe("packing-slip-pdf.service", () => {
  it("renders a non-empty PDF buffer", async () => {
    const buffer = await renderOrderPackingSlipPdf(FIXTURE_ORDER);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("shipping-label-pdf.service", () => {
  it("renders a non-empty PDF buffer", async () => {
    const buffer = await renderOrderShippingLabelPdf(FIXTURE_ORDER);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
