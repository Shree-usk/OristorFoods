"use client";

import { CartDrawer } from "@/components/storefront/cart/cart-drawer";
import { useUiStore } from "@/lib/stores/use-ui-store";

/**
 * Mounted once in the storefront layout so the cart drawer is available on
 * every page, opened via `useUiStore`'s `openCartDrawer` (triggered by
 * `useAddToCart` on a successful add) rather than any per-page state.
 */
export function CartDrawerController() {
  const isOpen = useUiStore((state) => state.isCartDrawerOpen);
  const closeCartDrawer = useUiStore((state) => state.closeCartDrawer);
  return <CartDrawer open={isOpen} onClose={closeCartDrawer} />;
}
