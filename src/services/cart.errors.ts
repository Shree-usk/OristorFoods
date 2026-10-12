/**
 * Typed errors thrown by cart.service.ts. Route handlers map `code` to an
 * HTTP status in one place (src/lib/api/cart-responses.ts) instead of
 * matching on message strings.
 */
export type CartErrorCode =
  | "not_found"
  | "forbidden"
  | "stock_exceeded"
  | "unavailable"
  | "bundle_unavailable"
  | "bundle_stock_exceeded"
  | "bundle_selection_invalid"
  | "bundle_line_locked";

export class CartServiceError extends Error {
  readonly code: CartErrorCode;

  constructor(code: CartErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class CartItemNotFoundError extends CartServiceError {
  constructor() {
    super("not_found", "Cart item not found");
  }
}

export class CartItemForbiddenError extends CartServiceError {
  constructor() {
    super("forbidden", "This cart item doesn't belong to your cart");
  }
}

export class StockExceededError extends CartServiceError {
  constructor(readonly availableQuantity: number) {
    super("stock_exceeded", `Only ${availableQuantity} left in stock`);
  }
}

export class ProductUnavailableError extends CartServiceError {
  constructor() {
    super("unavailable", "This product is no longer available");
  }
}

// --- Bundles (Story 2) ---

export class BundleUnavailableError extends CartServiceError {
  constructor() {
    super("bundle_unavailable", "This bundle is no longer available");
  }
}

export class BundleStockExceededError extends CartServiceError {
  constructor(readonly availableQuantity: number) {
    super("bundle_stock_exceeded", `Only ${availableQuantity} of this bundle left in stock`);
  }
}

/** Thrown when a Selectable/MixAndMatch bundle's selection fails server-side validation (wrong item, bad quantity, min/max not met). */
export class BundleSelectionInvalidError extends CartServiceError {
  constructor(message: string) {
    super("bundle_selection_invalid", message);
  }
}

/** A bundle's exploded component rows can only be resized/removed as a whole group — see bundle.service.ts::removeBundleFromCart. */
export class BundleLineLockedError extends CartServiceError {
  constructor() {
    super("bundle_line_locked", "This item is part of a bundle — remove or adjust the whole bundle instead.");
  }
}
