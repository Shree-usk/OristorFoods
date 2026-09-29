export type OrderErrorCode =
  | "insufficient_stock"
  | "order_number_exhausted"
  | "not_found"
  | "forbidden"
  | "illegal_transition"
  | "concurrent_transition"
  | "cancellation_not_allowed"
  | "return_not_allowed"
  | "invalid_return_quantity";

export class OrderServiceError extends Error {
  constructor(
    public readonly code: OrderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OrderServiceError";
  }
}

export class InsufficientStockError extends OrderServiceError {
  constructor(public readonly productName: string) {
    super("insufficient_stock", `"${productName}" no longer has enough stock to fulfil this order.`);
  }
}

export class OrderNumberExhaustedError extends OrderServiceError {
  constructor() {
    super("order_number_exhausted", "Could not allocate a unique order number. Please try again.");
  }
}

export class OrderNotFoundError extends OrderServiceError {
  constructor() {
    super("not_found", "Order not found.");
  }
}

export class OrderForbiddenError extends OrderServiceError {
  constructor() {
    super("forbidden", "You do not have access to this order.");
  }
}

export class IllegalOrderTransitionError extends OrderServiceError {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super("illegal_transition", `Cannot move an order from "${from}" to "${to}".`);
  }
}

/**
 * A transition's optimistic-concurrency guard (updateMany matched zero
 * rows) — another request already moved the order off the status this
 * caller read. Mirrors InsufficientStockError's conditional-update
 * pattern; the caller re-reads and retries or surfaces a 409.
 */
export class ConcurrentTransitionError extends OrderServiceError {
  constructor() {
    super("concurrent_transition", "This order's status changed while your request was processing. Please try again.");
  }
}

export class OrderCancellationNotAllowedError extends OrderServiceError {
  constructor(public readonly currentStatus: string) {
    super("cancellation_not_allowed", `An order that is "${currentStatus}" can no longer be cancelled.`);
  }
}

/** STORY-036. Only a Delivered order can have a return requested. */
export class OrderReturnNotAllowedError extends OrderServiceError {
  constructor(public readonly currentStatus: string) {
    super("return_not_allowed", `An order that is "${currentStatus}" cannot be returned.`);
  }
}

/** STORY-036. A requested return quantity exceeds what was actually ordered on that line. */
export class InvalidReturnQuantityError extends OrderServiceError {
  constructor() {
    super("invalid_return_quantity", "A requested return quantity exceeds the quantity originally ordered.");
  }
}
