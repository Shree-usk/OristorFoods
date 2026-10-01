/** STORY-047. Fetch wrappers for /api/admin/orders/* — mirrors admin-qa-client.ts's assertOk convention. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type OrderStatusValue = "PendingConfirmation" | "Confirmed" | "Processing" | "Dispatched" | "Delivered" | "Cancelled" | "Returned";
export type PaymentStatusValue = "Pending" | "Succeeded" | "Failed" | "Refunded";
export type ReturnReasonCodeValue = "Damaged" | "WrongItem" | "NotAsDescribed" | "ChangedMind" | "Other";

export interface OrderAdminListItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  status: OrderStatusValue;
  paymentStatus: PaymentStatusValue | null;
  grandTotal: number;
  currency: string;
  itemCount: number;
  placedAt: string;
}

export interface OrderAdminListFilters {
  page?: number;
  pageSize?: number;
  status?: OrderStatusValue;
  paymentStatus?: PaymentStatusValue;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface OrderAdminListResult {
  items: OrderAdminListItem[];
  total: number;
}

export interface OrderAdminDetailLineItem {
  orderItemId: string;
  productId: string | null;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderAdminDetail {
  orderNumber: string;
  status: OrderStatusValue;
  placedAt: string;
  customerName: string;
  customerEmail: string | null;
  shippingAddress: { recipientName: string; phone: string; line1: string; line2?: string; city: string; district?: string; postalCode?: string };
  items: OrderAdminDetailLineItem[];
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  discountLabel: string | null;
  grandTotal: number;
  currency: string;
  deliveryZoneName: string;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  statusHistory: { status: string; actor: string; createdAt: string }[];
  tracking: { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null };
  payment: { provider: string; status: string; amount: number; currency: string } | null;
  refundRecords: { id: string; amount: number; reason: string; processedById: string; createdAt: string }[];
  returnRequests: { id: string; status: string; reason: string; reasonCode: string | null; restocked: boolean; createdAt: string; processedAt: string | null }[];
  nextLegalStatuses: OrderStatusValue[];
}

function queryString(filters: OrderAdminListFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.status) params.set("status", filters.status);
  if (filters.paymentStatus) params.set("paymentStatus", filters.paymentStatus);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}

export async function fetchOrdersAdmin(filters: OrderAdminListFilters): Promise<OrderAdminListResult> {
  const response = await fetch(`/api/admin/orders?${queryString(filters)}`);
  assertOk(response, "Failed to load orders");
  return response.json();
}

export async function fetchOrderAdminDetail(id: string): Promise<OrderAdminDetail> {
  const response = await fetch(`/api/admin/orders/${id}`);
  assertOk(response, "Failed to load the order");
  return response.json();
}

export async function changeOrderStatusAdmin(id: string, status: OrderStatusValue): Promise<OrderAdminDetail> {
  const response = await fetch(`/api/admin/orders/${id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  await assertOkWithServerMessage(response, "Failed to change status");
  return response.json();
}

export async function bulkChangeOrderStatusAdmin(orderIds: string[], status: OrderStatusValue): Promise<{ updated: string[]; skipped: string[] }> {
  const response = await fetch("/api/admin/orders/bulk-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderIds, status }),
  });
  await assertOkWithServerMessage(response, "Failed to bulk-update status");
  return response.json();
}

export async function refundOrderAdmin(id: string, amount: number, reason: string): Promise<void> {
  const response = await fetch(`/api/admin/orders/${id}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, reason }),
  });
  await assertOkWithServerMessage(response, "Failed to process the refund");
}

export async function processReturnAdmin(
  id: string,
  input: { items: { orderItemId: string; productName: string; quantity: number }[]; reasonCode: ReturnReasonCodeValue; restocked: boolean },
): Promise<void> {
  const response = await fetch(`/api/admin/orders/${id}/return`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to process the return");
}

export const orderInvoiceUrl = (id: string) => `/api/admin/orders/${id}/invoice`;
export const orderPackingSlipUrl = (id: string) => `/api/admin/orders/${id}/packing-slip`;
export const orderShippingLabelUrl = (id: string) => `/api/admin/orders/${id}/shipping-label`;
