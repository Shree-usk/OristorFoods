import type { DeliveryResolution } from "@/types/checkout";

export type CheckoutErrorCode =
  | "empty_cart"
  | "cart_invalid"
  | "delivery_unavailable"
  | "payment_not_confirmed"
  | "totals_changed"
  | "guest_email_required"
  | "address_not_found";

export class CheckoutServiceError extends Error {
  constructor(
    public readonly code: CheckoutErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CheckoutServiceError";
  }
}

export class EmptyCartError extends CheckoutServiceError {
  constructor() {
    super("empty_cart", "Your cart is empty.");
  }
}

export class CartInvalidError extends CheckoutServiceError {
  constructor() {
    super("cart_invalid", "Some items in your cart are unavailable or exceed current stock. Please review your cart.");
  }
}

export class DeliveryUnavailableError extends CheckoutServiceError {
  constructor(public readonly resolutionStatus: Exclude<DeliveryResolution["status"], "ok">) {
    super("delivery_unavailable", "Delivery pricing is unavailable for this address. Please contact support for a shipping quote.");
  }
}

export class PaymentNotConfirmedError extends CheckoutServiceError {
  constructor() {
    super("payment_not_confirmed", "Your payment has not been confirmed. Please complete the payment step.");
  }
}

/**
 * Prices, stock, or the delivery charge moved between payment
 * confirmation and order placement — the confirmed payment amount no
 * longer matches the recomputed total. The customer reviews the new
 * total and pays again with a fresh intent.
 */
export class TotalsChangedError extends CheckoutServiceError {
  constructor() {
    super("totals_changed", "Your order total changed while you were checking out. Please review the updated total and try the payment step again.");
  }
}

export class GuestEmailRequiredError extends CheckoutServiceError {
  constructor() {
    super("guest_email_required", "An email address is required to place an order as a guest.");
  }
}

export class AddressNotFoundError extends CheckoutServiceError {
  constructor() {
    super("address_not_found", "The selected address could not be found.");
  }
}
