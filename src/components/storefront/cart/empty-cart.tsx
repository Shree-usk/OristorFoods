import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <ShoppingCart className="size-12 text-charcoal/40" aria-hidden="true" />
      <p className="text-h4 font-heading text-charcoal">Your cart is empty</p>
      <p className="text-small text-charcoal/70">Looks like you haven&apos;t added anything yet.</p>
      <Link href="/products" className={buttonVariants({ variant: "default" })}>
        Shop Products
      </Link>
    </div>
  );
}
