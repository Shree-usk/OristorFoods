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
  | "bundle_line_locked"
  | "packaging_unavailable"
  | "packaging_minimum_quantity"
  | "packaging_minimum_weight"
  | "packaging_availability_mismatch"
  | "packaging_selection_invalid";

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

// --- Custom Packaging (Story 3) ---

/** The selected packaging option is deactivated, discontinued, outside its availability window, or past its order cutoff. */
export class PackagingUnavailableError extends CartServiceError {
  constructor() {
    super("packaging_unavailable", "This packaging option is no longer available");
  }
}

export class PackagingMinimumQuantityError extends CartServiceError {
  constructor(readonly minQuantity: number) {
    super("packaging_minimum_quantity", `This packaging option requires a minimum quantity of ${minQuantity}`);
  }
}

/** Weight-based packaging (Story 3b). The aggregate net weight across every cart line sharing this option falls short of its configured minimum order weight. */
export class PackagingMinimumWeightError extends CartServiceError {
  constructor(readonly minOrderWeightGrams: number) {
    super("packaging_minimum_weight", `This packaging option requires a minimum order weight of ${minOrderWeightGrams}g`);
  }
}

/** The customer's local/export self-declaration doesn't match the option's configured availability. */
export class PackagingAvailabilityMismatchError extends CartServiceError {
  constructor() {
    super("packaging_availability_mismatch", "This packaging option isn't available for the selected local/export declaration");
  }
}

/** The packaging option doesn't belong to this product, or (if variant-pinned) doesn't match the selected variant. */
export class PackagingSelectionInvalidError extends CartServiceError {
  constructor(message: string = "This packaging selection is invalid for this product") {
    super("packaging_selection_invalid", message);
  }
}
