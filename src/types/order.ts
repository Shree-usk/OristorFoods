/**
 * Order-list types (STORY-028), shared by server and client code. Full
 * order-detail shape lives in types/checkout.ts's OrderConfirmationSummary
 * (reused by both the confirmation page and the order-detail API — see
 * checkout.service.ts's getConfirmation).
 */

export interface OrderListSummary {
  orderNumber: string;
  status: string;
  grandTotal: number;
  currency: string;
  itemCount: number;
  createdAt: string;
}

export interface OrderListResult {
  orders: OrderListSummary[];
  total: number;
  page: number;
  pageSize: number;
}
