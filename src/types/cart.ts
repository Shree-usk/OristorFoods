/**
 * Cart types shared by server and client code (STORY-024). Keep this file
 * free of server-only imports (Prisma, services): client components
 * import from it directly.
 */

export interface CartLineItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  /** Null for an unvarianted product — every line that existed before Product Variants shipped stays null. */
  variantId: string | null;
  variantName: string | null;
  /** Shared by every row exploded from one "add bundle to cart" action — null for a plain line. See bundle.service.ts. */
  bundleInstanceId: string | null;
  bundleName: string | null;
  /** Story 3 (Custom Packaging). Null for a plain/default-packaging line. packagingCharge is a SEPARATE amount from unitPrice, already folded into lineTotal — see cart.service.ts::toLineItem. */
  packagingOptionId: string | null;
  packagingMethodName: string | null;
  packagingCharge: number;
  packagingDeclaredAvailability: "Local" | "Export" | null;
  packagingRequiresManualReview: boolean;
  packagingLeadTimeDays: number | null;
  packagingShelfLifeDays: number | null;
  packagingShelfLifeText: string | null;
  packagingInstructions: string | null;
  /** Null when the product/variant has no image — render a placeholder, never an empty src. */
  imageSrc: string | null;
  imageAlt: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  lineTotal: number;
  rewardPointsEarned: number;
  /** True exactly once, on the first read after the live price differs from the last-seen snapshot. */
  priceChanged: boolean;
  /** The product is no longer Published — the line can't be purchased as-is. */
  unavailable: boolean;
  /** The requested quantity now exceeds Product.stockQuantity; availableQuantity is the current on-hand number. */
  quantityCapped: boolean;
  availableQuantity: number;
}

/** STORY-029. One entry per applied discount source (never more than one coupon; zero or more promotions). */
export interface AppliedDiscountLine {
  sourceType: "coupon" | "promotion";
  label: string;
  amount: number;
  isFreeShipping: boolean;
}

export interface CartDiscount {
  amount: number;
  applied: AppliedDiscountLine[];
  freeShippingApplied: boolean;
}

export interface CartSummary {
  items: CartLineItem[];
  itemCount: number;
  subtotal: number;
  currency: string;
  rewardPointsEarned: number;
  /** null when no coupon is applied AND no promotion is active. */
  discount: CartDiscount | null;
  /** The applied coupon's code, or null — set even when the coupon currently contributes $0 (see couponInvalidReason). */
  couponCode: string | null;
  /** Why an applied coupon isn't (or is no longer) contributing — e.g. cart dropped below its minimum. Null when there's no issue. */
  couponInvalidReason: string | null;
  /** STORY-030. The signed-in customer's current spendable reward-points balance — always 0 for a guest cart. */
  pointsBalance: number;
  /**
   * Preview only, computed against subtotal-minus-discount (no delivery
   * term — the true final amount is always recomputed at checkout,
   * same precedent as the coupon FreeShipping cart-level preview). Null
   * when nothing is set to redeem or redemption isn't currently valid.
   */
  pointsRedemption: { points: number; value: number } | null;
}
