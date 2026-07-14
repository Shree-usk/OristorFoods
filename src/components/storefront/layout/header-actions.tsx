"use client";

import Link from "next/link";
import { Gift, Search } from "lucide-react";

import { AccountMenu } from "./account-menu";
import { CartBadge } from "./cart-badge";
import { WishlistBadge } from "./wishlist-badge";

/**
 * Right-aligned desktop action cluster: Search, Wishlist, Rewards,
 * Account, Cart — per docs/blueprint.md Section 4.
 */
export function HeaderActions() {
  return (
    <div className="flex items-center gap-1">
      <SearchTrigger />
      <WishlistBadge />
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

/**
 * STORY-007 (Global Search) owns the actual search overlay/UX — this
 * button is the wired-but-inert trigger point described in this story's
 * scope. Replace the `onClick` body with opening STORY-007's overlay
 * once it lands; do not add search logic here in the meantime.
 */
function SearchTrigger() {
  return (
    <button
      type="button"
      aria-label="Search"
      onClick={() => {
        // Intentionally inert placeholder — see STORY-007.
      }}
      className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Search className="size-5" aria-hidden="true" />
    </button>
  );
}
