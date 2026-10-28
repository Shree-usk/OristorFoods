/** Typed errors thrown by gift-offer-admin.service.ts — mirrors coupon.errors.ts's admin-facing shape. */
export type GiftOfferAdminErrorCode = "not_found" | "product_already_has_offer";

export class GiftOfferAdminServiceError extends Error {
  constructor(
    public readonly code: GiftOfferAdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GiftOfferAdminServiceError";
  }
}

export class GiftOfferAdminNotFoundError extends GiftOfferAdminServiceError {
  constructor() {
    super("not_found", "That gift offer could not be found.");
  }
}

/** The qualifying product already has a gift offer (ProductBundle-style one-offer-per-product invariant, GiftOffer.productId @unique). */
export class GiftOfferProductAlreadyHasOfferError extends GiftOfferAdminServiceError {
  constructor() {
    super("product_already_has_offer", "This product already has a gift offer configured.");
  }
}
