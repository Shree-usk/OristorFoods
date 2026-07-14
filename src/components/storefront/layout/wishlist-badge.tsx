"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useWishlistStore } from "@/lib/stores/wishlist-store";

export function WishlistBadge() {
  const count = useWishlistStore((state) => state.count);

  return (
    <Link
      href="/account/wishlist"
      aria-label={count > 0 ? `Wishlist, ${count} item${count === 1 ? "" : "s"}` : "Wishlist"}
      className="relative inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Heart className="size-5" aria-hidden="true" />
      {count > 0 && (
        <Badge className="absolute top-0.5 right-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none">
          {count > 99 ? "99+" : count}
        </Badge>
      )}
    </Link>
  );
}
