export type ProductAdminErrorCode =
  | "not_found"
  | "slug_conflict"
  | "sku_conflict"
  | "barcode_conflict"
  | "illegal_transition"
  | "variant_not_found"
  | "variant_sku_conflict"
  | "variant_barcode_conflict"
  | "variant_has_orders";

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

export class ProductAdminBarcodeConflictError extends ProductAdminError {
  constructor(public readonly barcode: string) {
    super("barcode_conflict", `A product with barcode "${barcode}" already exists.`);
  }
}

export class ProductAdminIllegalTransitionError extends ProductAdminError {
  constructor(from: string, to: string) {
    super("illegal_transition", `Cannot change product status from ${from} to ${to}.`);
  }
}

export class ProductVariantNotFoundError extends ProductAdminError {
  constructor() {
    super("variant_not_found", "Product variant not found.");
  }
}

export class ProductVariantSkuConflictError extends ProductAdminError {
  constructor(public readonly sku: string) {
    super("variant_sku_conflict", `A variant with SKU "${sku}" already exists.`);
  }
}

export class ProductVariantBarcodeConflictError extends ProductAdminError {
  constructor(public readonly barcode: string) {
    super("variant_barcode_conflict", `A variant with barcode "${barcode}" already exists.`);
  }
}

export class ProductVariantHasOrdersError extends ProductAdminError {
  constructor() {
    super("variant_has_orders", "This variant has been ordered and cannot be deleted — deactivate it instead.");
  }
}
