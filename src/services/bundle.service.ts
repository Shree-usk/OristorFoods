import { randomUUID } from "node:crypto";

import { Prisma, type CustomerGroup } from "@/generated/prisma/client";
import * as bundleRepository from "@/repositories/bundle.repository";
import type { BundleWithItems } from "@/repositories/bundle.repository";
import * as cartRepository from "@/repositories/cart.repository";
import type { CartItemWithProduct } from "@/repositories/cart.repository";
import {
  BundleSelectionInvalidError,
  BundleStockExceededError,
  BundleUnavailableError,
  CartItemForbiddenError,
  CartItemNotFoundError,
} from "@/services/cart.errors";
import { recordAddToCartInteraction, requireAvailableProduct, resolveCartIdentity, type CartIdentityResult } from "@/services/cart-identity.service";
import { computeBundleDiscountedTotal, distributeBundleTotal, type BundleComponentPriceInput } from "@/services/bundle-pricing.service";
import { isActiveAndInWindow } from "@/services/eligibility-window";
import { resolveCustomerGroupForUser, resolvePrice } from "@/services/pricing.service";
import { requireAvailableVariant, resolveVariantPrice } from "@/services/product-variant.service";

/**
 * Customer-facing cart orchestration for bundles (Story 2). A bundle
 * instance in the cart ALWAYS represents exactly one unit of the bundle —
 * a customer who wants two of the same bundle adds it twice, creating two
 * independent bundleInstanceIds, each its own removable group. This
 * deliberately avoids a separate "bundle quantity" concept layered on top
 * of each row's own quantity: it would require persisting a bundle-level
 * quantity nowhere the current CartItem shape has room for, and isn't
 * something the brief's acceptance scenarios require. See
 * docs/architecture-decisions.md.
 *
 * Mirrors cart.service.ts's own split: this file never trusts a client-
 * supplied price/discount — every row's unitPriceSnapshot is derived here,
 * server-side, from the bundle definition and each component's own live
 * price, exactly once per add (and re-derived the same way on every cart
 * read — see resolveBundleInstancePrices, called from
 * cart.service.ts::buildSummary).
 */

export interface BundleSelectionInput {
  bundleItemId: string;
  /** Absolute quantity of this component for ONE unit of the bundle. */
  quantity: number;
}

interface ResolvedBundleRow {
  bundleItemId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPriceSnapshot: Prisma.Decimal;
}

function assertBundlePurchasable(bundle: BundleWithItems): void {
  if (!isActiveAndInWindow(bundle)) throw new BundleUnavailableError();
}

type EffectiveItem = { item: BundleWithItems["items"][number]; quantity: number };

/**
 * Resolves which (BundleItem, quantity) pairs make up one unit of the
 * bundle. Fixed: every isRequired item at its own locked quantity,
 * `selections` ignored. Selectable/MixAndMatch: validates the customer's
 * selections server-side — which items exist on this bundle, each item's
 * own min/max, and the bundle's own total min/max — never trusting the
 * client beyond "which items, how many."
 */
function resolveEffectiveItems(bundle: BundleWithItems, selections: BundleSelectionInput[] | null): EffectiveItem[] {
  if (bundle.bundleType === "Fixed") {
    return bundle.items.filter((item) => item.isRequired).map((item) => ({ item, quantity: item.quantity }));
  }

  if (!selections || selections.length === 0) throw new BundleSelectionInvalidError("Select at least one item for this bundle.");

  const itemsById = new Map(bundle.items.map((item) => [item.id, item]));
  const effective: EffectiveItem[] = selections.map((selection) => {
    const item = itemsById.get(selection.bundleItemId);
    if (!item) throw new BundleSelectionInvalidError("One of the selected items is not part of this bundle.");
    if (!Number.isInteger(selection.quantity) || selection.quantity <= 0) throw new BundleSelectionInvalidError("Quantity must be a positive whole number.");
    if (selection.quantity < item.minQuantity) throw new BundleSelectionInvalidError(`Select at least ${item.minQuantity} of ${item.componentProduct.name}.`);
    if (item.maxQuantity !== null && selection.quantity > item.maxQuantity) throw new BundleSelectionInvalidError(`Select at most ${item.maxQuantity} of ${item.componentProduct.name}.`);
    return { item, quantity: selection.quantity };
  });

  const totalQuantity = effective.reduce((sum, row) => sum + row.quantity, 0);
  if (bundle.minQuantity !== null && totalQuantity < bundle.minQuantity) throw new BundleSelectionInvalidError(`Select at least ${bundle.minQuantity} items in total.`);
  if (bundle.maxQuantity !== null && totalQuantity > bundle.maxQuantity) throw new BundleSelectionInvalidError(`Select at most ${bundle.maxQuantity} items in total.`);

  return effective;
}

async function resolveLiveUnitPrice(item: BundleWithItems["items"][number], quantity: number, customerGroup: CustomerGroup): Promise<Prisma.Decimal> {
  if (item.componentVariantId) {
    const variant = await requireAvailableVariant(item.componentVariantId, quantity);
    return new Prisma.Decimal(resolveVariantPrice(variant).price);
  }
  await requireAvailableProduct(item.componentProductId, quantity);
  const resolved = await resolvePrice({ productId: item.componentProductId, customerGroup, quantity });
  return resolved?.price ?? new Prisma.Decimal(0);
}

/**
 * Resolves one unit of a bundle into priced, exploded component rows.
 * The bundle's own discount is computed ONCE here (against the sum of the
 * components' live standalone prices) and baked into each row's
 * unitPriceSnapshot — never added as a candidate to discount.service.ts's
 * coupon/promotion pool, so it can never be double-applied.
 */
export async function resolveBundleSelection(
  bundle: BundleWithItems,
  selections: BundleSelectionInput[] | null,
  customerGroup: CustomerGroup,
): Promise<{ rows: ResolvedBundleRow[]; standaloneTotal: Prisma.Decimal; discountedTotal: Prisma.Decimal }> {
  const effective = resolveEffectiveItems(bundle, selections);

  const components: BundleComponentPriceInput[] = [];
  const unitPriceByItemId = new Map<string, Prisma.Decimal>();
  for (const { item, quantity } of effective) {
    const unitPrice = await resolveLiveUnitPrice(item, quantity, customerGroup);
    unitPriceByItemId.set(item.id, unitPrice);
    components.push({ componentId: item.id, unitPrice, quantity });
  }

  const standaloneTotal = components.reduce((sum, component) => sum.plus(new Prisma.Decimal(component.unitPrice).times(component.quantity)), new Prisma.Decimal(0));
  const discountedTotal = computeBundleDiscountedTotal(standaloneTotal, bundle);
  const distributed = distributeBundleTotal(components, discountedTotal);
  const snapshotByItemId = new Map(distributed.map((row) => [row.componentId, row.unitPriceSnapshot]));

  const rows: ResolvedBundleRow[] = effective.map(({ item, quantity }) => ({
    bundleItemId: item.id,
    productId: item.componentProductId,
    variantId: item.componentVariantId,
    quantity,
    unitPriceSnapshot: snapshotByItemId.get(item.id)!,
  }));

  return { rows, standaloneTotal, discountedTotal };
}

/**
 * Public, read-only preview for the storefront's Selectable/MixAndMatch
 * bundle picker (`POST /api/bundles/[bundleId]/preview`) — reruns the
 * exact same validation + pricing resolveBundleSelection does, without
 * writing anything to a cart, so the live price shown while picking is
 * always derived from the same server-side rules add-to-cart itself uses.
 */
export async function previewBundleSelection(bundleId: string, selections: BundleSelectionInput[] | null, customerGroup: CustomerGroup) {
  const bundle = await bundleRepository.findBundleById(bundleId);
  if (!bundle) throw new BundleUnavailableError();
  assertBundlePurchasable(bundle);
  const { standaloneTotal, discountedTotal } = await resolveBundleSelection(bundle, selections, customerGroup);
  return { standaloneTotal: standaloneTotal.toFixed(2), discountedTotal: discountedTotal.toFixed(2) };
}

export async function addBundleToCart(
  userId: string | null,
  guestCookieValue: string | null | undefined,
  bundleId: string,
  selections: BundleSelectionInput[] | null,
): Promise<CartIdentityResult> {
  const identity = await resolveCartIdentity(userId, guestCookieValue ?? undefined);
  const bundle = await bundleRepository.findBundleById(bundleId);
  if (!bundle) throw new BundleUnavailableError();
  assertBundlePurchasable(bundle);
  if (bundle.stockMode === "OwnStock" && (!bundle.inStock || (bundle.stockQuantity ?? 0) < 1)) throw new BundleStockExceededError(bundle.stockQuantity ?? 0);

  const customerGroup = await resolveCustomerGroupForUser(userId);
  const { rows } = await resolveBundleSelection(bundle, selections, customerGroup);

  const bundleInstanceId = randomUUID();
  for (const row of rows) {
    await cartRepository.upsertCartItem(identity.cart.id, row.productId, row.variantId, row.quantity, row.unitPriceSnapshot.toFixed(2), {
      bundleId: bundle.id,
      bundleInstanceId,
    });
  }

  for (const row of rows) {
    recordAddToCartInteraction(userId, row.productId).catch((error) => {
      console.error("[bundle] failed to record AddToCart interaction", error);
    });
  }

  return identity;
}

export async function removeBundleFromCart(userId: string | null, guestCookieValue: string | null | undefined, bundleInstanceId: string): Promise<void> {
  const { cart } = await resolveCartIdentity(userId, guestCookieValue ?? undefined);
  const items = await cartRepository.listBundleInstanceItems(cart.id, bundleInstanceId);
  if (items.length === 0) throw new CartItemNotFoundError();
  if (items.some((item) => item.cartId !== cart.id)) throw new CartItemForbiddenError();
  await cartRepository.deleteBundleInstance(cart.id, bundleInstanceId);
}

export interface BundleInstanceResolution {
  /** Live, re-derived unitPriceSnapshot (as a plain number) per CartItem.id — mirrors cart.service.ts's own per-line price-change re-resolution. */
  priceByItemId: Map<string, number>;
  /** bundleInstanceId values whose definition is no longer valid (deactivated, out of window, or missing a component) — those rows flag `unavailable`, never silently re-priced. */
  invalidInstanceIds: Set<string>;
}

/**
 * Called once per cart.service.ts::buildSummary read, batched over every
 * distinct bundle definition the cart currently holds (never per-row) —
 * same discipline as pricing.service.ts's resolvePricesForProducts.
 * Non-throwing by design: an unavailable component or a deactivated
 * bundle marks its instance invalid rather than rejecting the whole read.
 */
export async function resolveBundleInstancePrices(items: CartItemWithProduct[], customerGroup: CustomerGroup): Promise<BundleInstanceResolution> {
  const priceByItemId = new Map<string, number>();
  const invalidInstanceIds = new Set<string>();

  const bundleRows = items.filter((item) => item.bundleInstanceId && item.bundleId);
  if (bundleRows.length === 0) return { priceByItemId, invalidInstanceIds };

  const bundleIds = [...new Set(bundleRows.map((item) => item.bundleId as string))];
  const bundles = await bundleRepository.findBundlesByIds(bundleIds);
  const bundleById = new Map(bundles.map((bundle) => [bundle.id, bundle]));

  const rowsByInstance = new Map<string, CartItemWithProduct[]>();
  for (const row of bundleRows) {
    const key = row.bundleInstanceId as string;
    const list = rowsByInstance.get(key) ?? [];
    list.push(row);
    rowsByInstance.set(key, list);
  }

  for (const [instanceId, rows] of rowsByInstance) {
    const bundle = bundleById.get(rows[0].bundleId as string);
    if (!bundle) {
      invalidInstanceIds.add(instanceId);
      continue;
    }

    const now = new Date();
    let valid = bundle.status === "Active" && !(bundle.startDate && bundle.startDate > now) && !(bundle.endDate && bundle.endDate < now);

    const components: BundleComponentPriceInput[] = [];
    if (valid) {
      for (const row of rows) {
        const matchedItem = bundle.items.find((item) => item.componentProductId === row.productId && item.componentVariantId === row.variantId);
        if (!matchedItem) {
          valid = false;
          break;
        }
        try {
          const unitPrice = row.variantId
            ? new Prisma.Decimal(resolveVariantPrice((await requireAvailableVariant(row.variantId, row.quantity))).price)
            : await (async () => {
                await requireAvailableProduct(row.productId, row.quantity);
                const resolved = await resolvePrice({ productId: row.productId, customerGroup, quantity: row.quantity });
                return resolved?.price ?? new Prisma.Decimal(0);
              })();
          components.push({ componentId: row.id, unitPrice, quantity: row.quantity });
        } catch {
          valid = false;
          break;
        }
      }
    }

    if (!valid) {
      invalidInstanceIds.add(instanceId);
      continue;
    }

    const standaloneTotal = components.reduce((sum, component) => sum.plus(new Prisma.Decimal(component.unitPrice).times(component.quantity)), new Prisma.Decimal(0));
    const discountedTotal = computeBundleDiscountedTotal(standaloneTotal, bundle);
    const distributed = distributeBundleTotal(components, discountedTotal);
    for (const result of distributed) priceByItemId.set(result.componentId, result.unitPriceSnapshot.toNumber());
  }

  return { priceByItemId, invalidInstanceIds };
}
