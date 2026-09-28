/**
 * Typed errors thrown by cart.service.ts. Route handlers map `code` to an
 * HTTP status in one place (src/lib/api/cart-responses.ts) instead of
 * matching on message strings.
 */
export type CartErrorCode = "not_found" | "forbidden" | "stock_exceeded" | "unavailable";

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
