"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImagePlaceholder } from "@/components/storefront/product/image-placeholder";
import type { CartLineItem } from "@/types/cart";

interface CartLineItemRowProps {
  item: CartLineItem;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  /** True while a quantity-update or remove mutation targeting this row is in flight — disables its controls so a second click can't fire against a stale quantity. */
  isMutating?: boolean;
  /** The message from this row's most recent failed mutation, if any. */
  error?: string | null;
  /** Story 2 (Bundles). True for a bundle's exploded component row — quantity/remove are whole-bundle actions (see BundleGroupHeader), not per-row. */
  locked?: boolean;
}

export function CartLineItemRow({ item, onQuantityChange, onRemove, isMutating = false, error = null, locked = false }: CartLineItemRowProps) {
  const noticeId = `cart-item-notice-${item.id}`;
  const hasNotice = item.priceChanged || item.unavailable || item.quantityCapped || !!error;

  return (
    <div className="flex gap-4 border-b border-input py-4" aria-describedby={hasNotice ? noticeId : undefined}>
      <div className="relative size-20 shrink-0">
        {item.imageSrc ? <Image src={item.imageSrc} alt={item.imageAlt} fill sizes="80px" className="rounded-lg object-cover" /> : <ImagePlaceholder size="sm" />}
      </div>
      <div className="flex-1">
        <Link href={`/products/${item.productSlug}`} className="text-body font-medium text-charcoal hover:underline">
          {item.productName}
          {item.variantName && <span className="font-normal text-charcoal/70"> — {item.variantName}</span>}
        </Link>
        <p className="mt-1 text-small text-charcoal/70">
          {item.currency} {item.unitPrice.toFixed(2)} each
        </p>

        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Decrease quantity of ${item.productName}`}
            disabled={item.quantity <= 1 || isMutating || locked}
            onClick={() =>
              // When over-capped by more than one unit, a plain -1 step
              // would still exceed availableQuantity and the server would
              // reject it again — jump straight down to the available
              // amount instead, so the customer can always get unstuck in
              // one click.
              onQuantityChange(item.quantityCapped ? Math.min(item.quantity - 1, item.availableQuantity) : item.quantity - 1)
            }
          >
            <Minus />
          </Button>
          <span className="w-6 text-center font-number" aria-live="polite">
            {item.quantity}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Increase quantity of ${item.productName}`}
            disabled={item.quantity >= item.availableQuantity || isMutating || locked}
            onClick={() => onQuantityChange(item.quantity + 1)}
          >
            <Plus />
          </Button>
          {!locked && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${item.productName} from cart`} disabled={isMutating} onClick={onRemove}>
              <X />
            </Button>
          )}
        </div>

        {hasNotice && (
          <p id={noticeId} role="status" className="mt-2 text-small text-destructive">
            {error ??
              (item.unavailable
                ? "This item is no longer available."
                : item.quantityCapped
                  ? `Only ${item.availableQuantity} left in stock.`
                  : item.priceChanged
                    ? "The price for this item just changed."
                    : null)}
          </p>
        )}
      </div>
      <p className="font-number text-body text-charcoal">
        {item.currency} {item.lineTotal.toFixed(2)}
      </p>
    </div>
  );
}
