/**
 * Checkout types shared by server and client code (STORY-025). Keep this
 * file free of server-only imports (Prisma, services): client components
 * import from it directly.
 */

export interface CheckoutAddress {
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  district?: string;
  postalCode?: string;
}

export interface SavedAddress extends CheckoutAddress {
  id: string;
  isDefault: boolean;
}

/**
 * Result of resolving a delivery city against the zone/rate configuration.
 * Every non-"ok" status is a fail-safe: the UI blocks progress with a
 * clear message, never a silent ₨0 charge.
 */
export type DeliveryResolution =
  | {
      status: "ok";
      zoneName: string;
      charge: number;
      currency: string;
      freeShippingApplied: boolean;
      /** Amount still needed to reach the global threshold; null once reached or when no threshold is configured. */
      amountToFreeShipping: number | null;
      estimatedDaysMin: number | null;
      estimatedDaysMax: number | null;
      /** Campaign name when an active DeliveryRateOverride set the charge. */
      campaignApplied: string | null;
    }
  | { status: "no_zone" }
  | { status: "quote_required" }
  | { status: "config_error" };

export type MockPaymentOutcome = "success" | "decline" | "timeout";

export interface PaymentIntentResult {
  providerReference: string;
  amount: number;
  currency: string;
}

export interface OrderStatusHistoryEntry {
  status: string;
  actor: string;
  createdAt: string;
}

export interface OrderConfirmationSummary {
  orderNumber: string;
  status: string;
  placedAt: string;
  guestEmail: string | null;
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  /** STORY-029. "Coupon SAVE10" or "Weekend Sale" — null when nothing discounted the order. */
  discountLabel: string | null;
  couponCode: string | null;
  tax: number;
  grandTotal: number;
  currency: string;
  rewardPointsEarned: number;
  deliveryZoneName: string;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  shippingAddress: CheckoutAddress;
  items: Array<{
    productName: string;
    productSku: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
  /** STORY-028: timestamped pipeline, oldest first. */
  statusHistory: OrderStatusHistoryEntry[];
  erpSyncStatus: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
}
