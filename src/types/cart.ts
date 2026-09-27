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
  imageSrc: string;
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

export interface CartSummary {
  items: CartLineItem[];
  itemCount: number;
  subtotal: number;
  currency: string;
  rewardPointsEarned: number;
}
