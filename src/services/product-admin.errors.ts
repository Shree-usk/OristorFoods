export type ProductAdminErrorCode = "not_found" | "slug_conflict" | "sku_conflict" | "illegal_transition";

export class ProductAdminError extends Error {
  constructor(
    public readonly code: ProductAdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProductAdminError";
  }
}

export class ProductAdminNotFoundError extends ProductAdminError {
  constructor() {
    super("not_found", "Product not found.");
  }
}

export class ProductAdminSlugConflictError extends ProductAdminError {
  constructor(public readonly slug: string) {
    super("slug_conflict", `A product with slug "${slug}" already exists.`);
  }
}

export class ProductAdminSkuConflictError extends ProductAdminError {
  constructor(public readonly sku: string) {
    super("sku_conflict", `A product with SKU "${sku}" already exists.`);
  }
}

export class ProductAdminIllegalTransitionError extends ProductAdminError {
  constructor(from: string, to: string) {
    super("illegal_transition", `Cannot change product status from ${from} to ${to}.`);
  }
}
