"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useCart } from "@/hooks/use-cart";

export function CartBadge() {
  const { cart } = useCart();
  const count = cart?.itemCount ?? 0;

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
      className="relative inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ShoppingCart className="size-5" aria-hidden="true" />
      {count > 0 && (
        <Badge className="absolute top-0.5 right-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none">
          {count > 99 ? "99+" : count}
        </Badge>
      )}
    </Link>
  );
}
