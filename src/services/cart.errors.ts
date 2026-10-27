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
  | "gift_offer_unavailable"
  | "gift_offer_ineligible"
  | "gift_offer_stock_exceeded"
  | "gift_offer_redemption_limit_exceeded"
  | "gift_line_locked"
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

// --- Free Gift (Story 5) ---

/** The gift offer is Draft/Inactive, outside its scheduled window, or has been deactivated since it was added to the cart. */
export class GiftOfferUnavailableError extends CartServiceError {
  constructor() {
    super("gift_offer_unavailable", "This free gift offer is no longer available");
  }
}

/** The qualifying product's minQuantity/minSpend condition isn't met by the cart's current contents. */
export class GiftOfferIneligibleError extends CartServiceError {
  constructor(message: string = "You haven't met the conditions for this free gift yet") {
    super("gift_offer_ineligible", message);
  }
}

/** The gift offer's own dedicated stock pool (giftStockLimit) is exhausted — independent of the gift product's own sellable stock. */
export class GiftOfferStockExceededError extends CartServiceError {
  constructor() {
    super("gift_offer_stock_exceeded", "This free gift is no longer available — all redemptions have been claimed");
  }
}

/** redemptionLimitGlobal or redemptionLimitPerCustomer has already been reached. */
export class GiftOfferRedemptionLimitExceededError extends CartServiceError {
  constructor() {
    super("gift_offer_redemption_limit_exceeded", "This free gift's redemption limit has already been reached");
  }
}

/** A gift line's quantity/removal is fixed by its offer — mirrors BundleLineLockedError above. Resizing or removing it directly would let a customer claim more than giftQuantity units for free; use gift-offer.service.ts::removeGiftFromCart instead. */
export class GiftLineLockedError extends CartServiceError {
  constructor() {
    super("gift_line_locked", "This is a free gift item — remove it instead of changing its quantity.");
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
