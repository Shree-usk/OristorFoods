import { Prisma } from "@/generated/prisma/client";
import type { BundleDiscountType } from "@/generated/prisma/client";

/**
 * Pure, DB-free bundle pricing math (Story 2 — Bundles). Mirrors
 * discount.service.ts's calculateDiscount/resolveDiscountForCart split:
 * this file is the pure core, bundle.service.ts is the DB-reading
 * orchestrator that calls it.
 */

export interface BundleDiscountInput {
  discountType: BundleDiscountType | null;
  fixedPrice: Prisma.Decimal | number | null;
  percentOff: Prisma.Decimal | number | null;
  amountOff: Prisma.Decimal | number | null;
}

function toDecimal(value: Prisma.Decimal | number | null): Prisma.Decimal | null {
  if (value === null) return null;
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/**
 * The bundle's final price given the standalone (undiscounted) sum of its
 * resolved components. `discountType: null` means "no deal configured" —
 * the bundle is still a valid Fixed/Selectable/MixAndMatch grouping, just
 * priced at exactly what the parts would cost separately.
 */
export function computeBundleDiscountedTotal(standaloneTotal: Prisma.Decimal, discount: BundleDiscountInput): Prisma.Decimal {
  if (!discount.discountType) return standaloneTotal;

  if (discount.discountType === "FixedPrice") {
    const fixedPrice = toDecimal(discount.fixedPrice);
    if (fixedPrice === null) throw new Error("BundleDiscountType is FixedPrice but fixedPrice is not set");
    return fixedPrice;
  }

  if (discount.discountType === "PercentageOff") {
    const percentOff = toDecimal(discount.percentOff);
    if (percentOff === null) throw new Error("BundleDiscountType is PercentageOff but percentOff is not set");
    const multiplier = new Prisma.Decimal(100).minus(percentOff).dividedBy(100);
    return standaloneTotal.times(multiplier).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  // FixedAmountOff — floors at zero, same capping convention
  // discount.service.ts::candidateAmount uses for a coupon/promotion's
  // own FixedAmountOff (Math.min(amountOff, matching)).
  const amountOff = toDecimal(discount.amountOff);
  if (amountOff === null) throw new Error("BundleDiscountType is FixedAmountOff but amountOff is not set");
  const result = standaloneTotal.minus(amountOff);
  return result.isNegative() ? new Prisma.Decimal(0) : result;
}

export interface BundleComponentPriceInput {
  /** A stable key identifying this component row — the BundleItem.id, or a per-row key for a repeated selection. */
  componentId: string;
  /** The component's own live standalone unit price (resolveVariantPrice or resolvePrice). */
  unitPrice: Prisma.Decimal | number;
  quantity: number;
}

export interface DistributedComponentPrice {
  componentId: string;
  unitPriceSnapshot: Prisma.Decimal;
}

/**
 * Spreads a bundle's discounted total across its exploded component rows,
 * proportional to each component's own standalone line value (unitPrice ×
 * quantity) — not an even split, so a LKR 200 jar doesn't show the same
 * allocated price as a LKR 50 sachet.
 *
 * Uses the largest-remainder apportionment method in integer cents so the
 * sum across every row's (unitPriceSnapshot × quantity) always equals
 * discountedTotal exactly, whenever at least one component has
 * quantity === 1 (true for the overwhelming majority of real bundles) —
 * see the function body for how the unavoidable edge case (every
 * component has quantity > 1) is handled.
 */
export function distributeBundleTotal(components: BundleComponentPriceInput[], discountedTotal: Prisma.Decimal): DistributedComponentPrice[] {
  if (components.length === 0) return [];

  const standaloneLineCents = components.map((component) => {
    const unitPrice = toDecimal(component.unitPrice) ?? new Prisma.Decimal(0);
    return unitPrice.times(component.quantity).times(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  });
  const totalStandaloneCents = standaloneLineCents.reduce((sum, cents) => sum + cents, 0);
  const totalCents = discountedTotal.times(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();

  // Degenerate case (every component priced at 0, e.g. a free promotional
  // add-on) — split the total evenly rather than dividing by zero.
  const exactShares =
    totalStandaloneCents > 0
      ? standaloneLineCents.map((cents) => (cents / totalStandaloneCents) * totalCents)
      : components.map(() => totalCents / components.length);

  const baseShareCents = exactShares.map((share) => Math.floor(share));
  let leftoverCents = totalCents - baseShareCents.reduce((sum, cents) => sum + cents, 0);

  // Largest-remainder method: give the leftover cents, one at a time, to
  // the components whose exact share was rounded down the most.
  const remainderOrder = exactShares
    .map((share, index) => ({ index, remainder: share - baseShareCents[index] }))
    .sort((a, b) => b.remainder - a.remainder);
  const shareCents = [...baseShareCents];
  for (let i = 0; i < remainderOrder.length && leftoverCents > 0; i += 1) {
    shareCents[remainderOrder[i].index] += 1;
    leftoverCents -= 1;
  }

  // Dividing a component's share by its own quantity can leave a residual
  // cent of drift when quantity doesn't evenly divide the share — an
  // unavoidable fact of integer-cent currency, not a bug. Whichever
  // component is processed LAST absorbs the gap against every other
  // component's REALIZED (already-rounded) contribution — not their raw
  // pre-division cent share — so the bundle instance's grand total (what
  // buildSummary actually sums: Σ unitPriceSnapshot × quantity) comes out
  // exact whenever at least one component has quantity === 1. A
  // quantity-1 component (the overwhelming majority of real bundle rows)
  // is deliberately chosen to go last, regardless of its position in the
  // input array, specifically so this guarantee holds order-independently.
  // Only when EVERY component has quantity > 1 can a small residual drift
  // (at most a few cents) remain — accepted and documented, not hidden.
  const processingOrder = [...components.keys()];
  const quantityOneIndex = components.findIndex((component) => component.quantity === 1);
  if (quantityOneIndex !== -1) {
    processingOrder.splice(processingOrder.indexOf(quantityOneIndex), 1);
    processingOrder.push(quantityOneIndex);
  }

  const unitPriceSnapshotByIndex = new Array<Prisma.Decimal>(components.length);
  let realizedCentsSoFar = 0;
  processingOrder.forEach((componentIndex, position) => {
    const isLast = position === processingOrder.length - 1;
    const centsForThisComponent = isLast ? totalCents - realizedCentsSoFar : shareCents[componentIndex];
    const unitPriceSnapshot = new Prisma.Decimal(centsForThisComponent)
      .dividedBy(components[componentIndex].quantity)
      .dividedBy(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    unitPriceSnapshotByIndex[componentIndex] = unitPriceSnapshot;
    realizedCentsSoFar += unitPriceSnapshot.times(components[componentIndex].quantity).times(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  });

  return components.map((component, index) => ({ componentId: component.componentId, unitPriceSnapshot: unitPriceSnapshotByIndex[index] }));
}
