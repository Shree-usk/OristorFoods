"use client";

import Link from "next/link";
import { Gift } from "lucide-react";

import { SearchOverlay } from "@/components/storefront/search/search-overlay";
import { AccountMenu } from "./account-menu";
import { CartBadge } from "./cart-badge";
import { CompareTrayIndicator } from "./compare-tray-indicator";
import { WishlistBadge } from "./wishlist-badge";

/**
 * Hairline separator between logically distinct action groups below.
 * Hidden below `xl`: at `lg` (1024px) the 13 nav links + action cluster
 * only just fit without it (see header.tsx's own doc comment and
 * tests/e2e/layout.spec.ts's 1024px overflow check).
 */
function ActionDivider() {
  return <div aria-hidden="true" className="mx-1.5 hidden h-5 w-px bg-border xl:block" />;
}

/**
 * Right-aligned desktop action cluster, grouped by purpose: Search alone,
 * then Wishlist/Compare/Rewards (shopping aids), then Account, then Cart
 * — per docs/blueprint.md Section 4.
 */
export function HeaderActions() {
  return (
    <div className="flex items-center xl:gap-0.5">
      <SearchOverlay />
      <ActionDivider />
      <WishlistBadge />
      <CompareTrayIndicator />
      <Link
        href="/account/rewards"
        aria-label="Rewards"
        className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Gift className="size-5" aria-hidden="true" />
      </Link>
      <ActionDivider />
      <AccountMenu />
      <ActionDivider />
      <CartBadge />
    </div>
  );
}
