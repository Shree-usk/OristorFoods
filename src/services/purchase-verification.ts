/**
 * "Verified Purchase" hook for reviews (STORY-015). There is no Order model
 * yet, so the default verifier always answers false. STORY-028 (Order
 * Management) registers the real check at startup, the same way
 * product-detail-extensions.ts providers work, so review code never imports
 * order code. The flag is evaluated once, when a review is submitted.
 */
export type PurchaseVerifier = (userId: string, productId: string) => Promise<boolean>;

const defaultVerifier: PurchaseVerifier = async () => false;
let verifier: PurchaseVerifier = defaultVerifier;

export function registerPurchaseVerifier(next: PurchaseVerifier): void {
  verifier = next;
}

export function hasPurchasedProduct(userId: string, productId: string): Promise<boolean> {
  return verifier(userId, productId);
}

/** Test-only: restores the default verifier. */
export function resetPurchaseVerifierForTesting(): void {
  verifier = defaultVerifier;
}
