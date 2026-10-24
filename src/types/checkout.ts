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

/** Story 4 (Payment Restriction). Mirrors the Prisma PaymentMethod enum's values exactly — kept as a plain string union here since this file stays free of server-only imports. */
export type PaymentMethod = "Card" | "BankTransfer" | "CashOnDelivery";

/** Export fulfilment flow. Mirrors the Prisma FulfilmentMethod enum's values exactly. */
export type FulfilmentMethod = "Delivery" | "Pickup";

/** Export fulfilment flow. The admin's one configured pickup location — null until set, which disables the Pickup choice storewide. */
export interface PickupLocation {
  name: string;
  address: string;
  mapUrl: string | null;
}

/** Export fulfilment flow. One bank account shown at checkout once the customer chooses Bank Transfer. */
export interface CheckoutBankAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch: string | null;
  swiftCode: string | null;
  currency: string;
}

/** A payment method the current cart is allowed to use — admin-configured key/label, filtered server-side to the restricted set when the cart requires it. */
export interface EligiblePaymentMethod {
  method: PaymentMethod;
  label: string;
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
  /** STORY-030. 0 when no points were redeemed at this order's checkout. */
  pointsRedeemed: number;
  pointsRedemptionValue: number;
  tax: number;
  grandTotal: number;
  currency: string;
  /** Story 4 (Payment Restriction). Permanent snapshot of what the customer chose at checkout. */
  paymentMethod: PaymentMethod;
  rewardPointsEarned: number;
  /** Export fulfilment flow. "Delivery" for every pre-existing order. */
  fulfilmentMethod: FulfilmentMethod;
  /** Export fulfilment flow. Null for every order that isn't export-declared. */
  travelerName: string | null;
  travelerCountry: string | null;
  travelerPhone: string | null;
  deliveryZoneName: string;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  shippingAddress: CheckoutAddress;
  items: Array<{
    productName: string;
    productSku: string;
    variantName: string | null;
    /** Story 2 (Bundles). Shared by every row of one bundle instance — null for a plain line. */
    bundleInstanceId: string | null;
    bundleName: string | null;
    /** Story 3 (Custom Packaging). Permanent snapshot — null when no packaging was selected. */
    packagingMethodName: string | null;
    packagingCharge: number | null;
    packagingRequiresManualReview: boolean;
    /** Export fulfilment flow. Permanent snapshot of the "special conditions" the admin set on this packaging option. */
    packagingInstructions: string | null;
    /** Weight-based packaging pricing (Story 3b). Null unless this line's packaging was PerGram. */
    packagingChargeType: "Fixed" | "PerGram" | null;
    packagingRatePerGram: number | null;
    packagingNetWeightGrams: number | null;
    packagingMinimumChargeApplied: boolean;
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
