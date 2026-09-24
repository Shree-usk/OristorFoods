/**
 * "Verified Purchase" hook for reviews (STORY-015). There is no Order model
 * yet, so the default verifier always answers false. STORY-028 (Order
 * Management) registers the real check at startup, the same way
 * product-detail-extensions.ts providers work, so review code never imports
 * order code. The flag is evaluated once, when a review is submitted.
 *
 * Kept on globalThis, not in module scope, for the same reason as
 * product-detail-extensions.ts: registration happens from
 * src/instrumentation.ts, which Next.js bundles separately from the route
 * code that calls hasPurchasedProduct, so module-scoped state wouldn't be
 * shared between the two.
 */
export type PurchaseVerifier = (userId: string, productId: string) => Promise<boolean>;

const defaultVerifier: PurchaseVerifier = async () => false;

const globalForVerifier = globalThis as unknown as { __oristorPurchaseVerifier?: { verify: PurchaseVerifier } };
const holder = (globalForVerifier.__oristorPurchaseVerifier ??= { verify: defaultVerifier });

export function registerPurchaseVerifier(next: PurchaseVerifier): void {
  holder.verify = next;
}

export function hasPurchasedProduct(userId: string, productId: string): Promise<boolean> {
  return holder.verify(userId, productId);
}

/** Test-only: restores the default verifier. */
export function resetPurchaseVerifierForTesting(): void {
  holder.verify = defaultVerifier;
}
