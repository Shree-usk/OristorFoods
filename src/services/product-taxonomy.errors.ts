/** Allergen and Certification are simple, always-co-displayed reference tables (see product-taxonomy.service.ts) — one small error module for both. */
export type ProductTaxonomyErrorCode = "allergen_not_found" | "allergen_name_conflict" | "certification_not_found";

export class ProductTaxonomyError extends Error {
  constructor(
    public readonly code: ProductTaxonomyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProductTaxonomyError";
  }
}

export class AllergenNotFoundError extends ProductTaxonomyError {
  constructor() {
    super("allergen_not_found", "Allergen not found.");
  }
}

export class AllergenNameConflictError extends ProductTaxonomyError {
  constructor() {
    super("allergen_name_conflict", "An allergen with this name already exists.");
  }
}

export class CertificationNotFoundError extends ProductTaxonomyError {
  constructor() {
    super("certification_not_found", "Certification not found.");
  }
}
