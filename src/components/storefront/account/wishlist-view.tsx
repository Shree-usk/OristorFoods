"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useAddToCart } from "@/hooks/use-add-to-cart";
import { fetchProductsByIds, fetchWishlist, removeWishlistItem } from "@/lib/api/wishlist-client";
import { useWishlistStore } from "@/lib/stores/wishlist-store";
import { WishlistItemRow } from "@/components/storefront/account/wishlist-item-row";

export function WishlistView() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  // `useSession()` reports "loading" on the first client render. Without
  // gating on it the guest branch would run, resolve to [] synchronously
  // and flash the empty state on every signed-in visit before the real
  // wishlist query starts.
  const isSessionLoading = status === "loading";
  const queryClient = useQueryClient();
  const guestIds = useWishlistStore((state) => state.items);
  const guestRemove = useWishlistStore((state) => state.remove);
  const [announcement, setAnnouncement] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: isAuthenticated ? ["wishlist"] : ["wishlist-guest", guestIds],
    queryFn: () => (isAuthenticated ? fetchWishlist() : fetchProductsByIds(guestIds)),
    enabled: !isSessionLoading,
  });

  // isAvailable doesn't currently depend on which product id is passed
  // (the stub always returns false) — calling it once here for the
  // "move all" button's disabled state, rather than per-row, is safe
  // under that stub. Revisit if STORY-024's real hook makes availability
  // product-specific.
  const cartStub = useAddToCart(items[0]?.id ?? "");
  const inStockCount = items.filter((item) => item.inStock).length;

  function handleRemove(productId: string) {
    if (isAuthenticated) {
      // Announce only on a confirmed 2xx — a 401 (expired session) or 500
      // must not tell a screen-reader user the item was removed.
      removeWishlistItem(productId)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["wishlist"] });
          setAnnouncement("Removed from wishlist.");
        })
        .catch(() => {
          setAnnouncement("Could not remove that item. Please try again.");
        });
      return;
    }
    guestRemove(productId);
    setAnnouncement("Removed from wishlist.");
  }

  if (isSessionLoading || isLoading) return null;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-h3 text-charcoal">Your wishlist is empty</h1>
        <p className="mt-2 text-body text-charcoal/80">
          Save products you&apos;re interested in and they&apos;ll show up here.
        </p>
        <Button className="mt-6" nativeButton={false} render={<Link href="/products" />}>
          Browse Products
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-h3 text-charcoal">My Wishlist</h1>
        <div className="text-right">
          <Button type="button" disabled={!cartStub.isAvailable || inStockCount === 0}>
            Move all to cart
          </Button>
          <p className="mt-1 text-caption text-charcoal/70">
            {inStockCount} of {items.length} item{items.length === 1 ? "" : "s"} in stock
          </p>
        </div>
      </div>
      <ul className="mt-6">
        {items.map((item) => (
          <WishlistItemRow key={item.id} item={item} onRemove={() => handleRemove(item.id)} />
        ))}
      </ul>
    </div>
  );
}
