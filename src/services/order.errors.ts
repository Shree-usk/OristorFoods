export type OrderErrorCode = "insufficient_stock" | "order_number_exhausted" | "not_found" | "forbidden";

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
