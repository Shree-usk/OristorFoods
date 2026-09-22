"use client";

import Link from "next/link";
import { Gift } from "lucide-react";

import { SearchOverlay } from "@/components/storefront/search/search-overlay";
import { AccountMenu } from "./account-menu";
import { CartBadge } from "./cart-badge";
import { CompareTrayIndicator } from "./compare-tray-indicator";
import { WishlistBadge } from "./wishlist-badge";

/**
 * Right-aligned desktop action cluster: Search, Wishlist, Rewards,
 * Account, Cart — per docs/blueprint.md Section 4.
 */
export function HeaderActions() {
  return (
    <div className="flex items-center gap-1">
      <SearchOverlay />
      <WishlistBadge />
      <CompareTrayIndicator />
      <Link
        href="/account/rewards"
        aria-label="Rewards"
        className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Gift className="size-5" aria-hidden="true" />
      </Link>
      <AccountMenu />
      <CartBadge />
    </div>
  );
}
