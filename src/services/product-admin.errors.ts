export type ProductAdminErrorCode =
  | "not_found"
  | "slug_conflict"
  | "sku_conflict"
  | "barcode_conflict"
  | "illegal_transition"
  | "variant_not_found"
  | "variant_sku_conflict"
  | "variant_barcode_conflict"
  | "variant_has_orders"
  | "bundle_not_found"
  | "bundle_already_exists"
  | "bundle_item_not_found"
  | "packaging_method_not_found"
  | "packaging_method_name_conflict"
  | "packaging_option_not_found"
  | "packaging_option_duplicate"
  | "packaging_option_variant_mismatch"
  | "packaging_option_requires_variants";

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

export class BundleNotFoundError extends ProductAdminError {
  constructor() {
    super("bundle_not_found", "This product has no bundle configured.");
  }
}

/** A product can have at most one ProductBundle (productId is @unique). */
export class BundleAlreadyExistsError extends ProductAdminError {
  constructor() {
    super("bundle_already_exists", "This product already has a bundle configured.");
  }
}

export class BundleItemNotFoundError extends ProductAdminError {
  constructor() {
    super("bundle_item_not_found", "Bundle component not found.");
  }
}

export class PackagingMethodNotFoundError extends ProductAdminError {
  constructor() {
    super("packaging_method_not_found", "Packaging method not found.");
  }
}

export class PackagingMethodNameConflictError extends ProductAdminError {
  constructor(public readonly name: string) {
    super("packaging_method_name_conflict", `A packaging method named "${name}" already exists.`);
  }
}

export class PackagingOptionNotFoundError extends ProductAdminError {
  constructor() {
    super("packaging_option_not_found", "Packaging option not found.");
  }
}

export class PackagingOptionDuplicateError extends ProductAdminError {
  constructor() {
    super("packaging_option_duplicate", "This product already has that packaging method configured for this scope.");
  }
}

/** The optional variant pin must be one of this same product's own variants — unlike BundleItem, which legitimately points at an arbitrary other product's variant. */
export class PackagingOptionVariantMismatchError extends ProductAdminError {
  constructor() {
    super("packaging_option_variant_mismatch", "The selected variant does not belong to this product.");
  }
}

/** Weight-based packaging (Story 3b). A PerGram charge needs an authoritative per-unit net weight, which only exists on a ProductVariant — a variant-less product has no such signal (Product.weightGrams is a different, unrelated, delivery-zone-only field). */
export class PackagingOptionRequiresVariantsError extends ProductAdminError {
  constructor() {
    super("packaging_option_requires_variants", "Per-gram packaging requires this product to have at least one variant.");
  }
}
