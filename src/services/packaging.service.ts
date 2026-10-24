import { Prisma } from "@/generated/prisma/client";
import type { PackagingAvailability, PackagingDeclaredAvailability } from "@/generated/prisma/client";
import * as packagingRepository from "@/repositories/packaging.repository";
import type { PackagingOptionWithMethod } from "@/repositories/packaging.repository";
import type { CartItemWithProduct } from "@/repositories/cart.repository";
import {
  PackagingAvailabilityMismatchError,
  PackagingMinimumQuantityError,
  PackagingMinimumWeightError,
  PackagingSelectionInvalidError,
  PackagingUnavailableError,
} from "@/services/cart.errors";

/**
 * Customer-facing packaging selection/eligibility (Story 3 — Custom
 * Packaging). Deliberately lighter than bundle.service.ts: a packaging
 * choice is a single attribute of a single already-existing cart row, not
 * a multi-row instance needing explosion or proportional price
 * distribution.
 */

export function isAvailabilityCompatible(optionAvailability: PackagingAvailability, declared: PackagingDeclaredAvailability): boolean {
  return optionAvailability === "Both" || optionAvailability === declared;
}

export type PackagingSelectionValidityResult =
  | { valid: true }
  | { valid: false; reason: "unavailable" | "minimum_quantity" | "availability_mismatch" };

/** The subset of a ProductPackagingOption (+ its method) the validity check needs — satisfied by both packaging.repository.ts's rows and a CartItemWithProduct's nested `packagingOption`. */
export interface PackagingOptionForValidity {
  status: string;
  availabilityStartDate: Date | null;
  availabilityEndDate: Date | null;
  orderCutoffDate: Date | null;
  minQuantity: number | null;
  availability: PackagingAvailability;
  packagingMethod: { status: string };
}

/**
 * Pure, DB-free. The single source of truth both the throwing add-time
 * path (resolvePackagingSelection) and the non-throwing read-time path
 * (resolvePackagingForCartItems) reuse — never duplicated.
 */
export function packagingSelectionValidity(
  option: PackagingOptionForValidity,
  quantity: number,
  declared: PackagingDeclaredAvailability,
  now: Date,
): PackagingSelectionValidityResult {
  if (option.status !== "Active" || option.packagingMethod.status !== "Active") return { valid: false, reason: "unavailable" };
  if (option.availabilityStartDate && option.availabilityStartDate > now) return { valid: false, reason: "unavailable" };
  if (option.availabilityEndDate && option.availabilityEndDate < now) return { valid: false, reason: "unavailable" };
  if (option.orderCutoffDate && option.orderCutoffDate < now) return { valid: false, reason: "unavailable" };
  if (!isAvailabilityCompatible(option.availability, declared)) return { valid: false, reason: "availability_mismatch" };
  if (option.minQuantity !== null && quantity < option.minQuantity) return { valid: false, reason: "minimum_quantity" };
  return { valid: true };
}

export type PackagingWeightGroupValidityResult = { valid: true } | { valid: false; reason: "minimum_weight" };

/**
 * Weight-based packaging (Story 3b). The single source of truth for the
 * minimum-order-weight floor — reused by both the add-time, aggregate-aware
 * check in resolvePackagingSelection and the read-time, per-group check in
 * resolvePackagingForCartItems, mirroring packagingSelectionValidity's own
 * single-source-of-truth discipline.
 */
export function packagingWeightGroupValidity(groupWeightGrams: number, minOrderWeightGrams: number | null): PackagingWeightGroupValidityResult {
  if (minOrderWeightGrams !== null && groupWeightGrams < minOrderWeightGrams) return { valid: false, reason: "minimum_weight" };
  return { valid: true };
}

/**
 * Pure Decimal math: weight x rate, floored by the option's configured
 * minimum packaging charge (if any). Decimal throughout, rounded to
 * currency precision only at the end — never float arithmetic for money.
 */
export function calculatePerGramCharge(
  groupWeightGrams: number,
  ratePerGram: Prisma.Decimal,
  minPackagingCharge: Prisma.Decimal | null,
): { rawCharge: Prisma.Decimal; finalCharge: Prisma.Decimal; minimumChargeApplied: boolean } {
  const rawCharge = ratePerGram.times(groupWeightGrams).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const finalCharge = minPackagingCharge !== null && rawCharge.lessThan(minPackagingCharge) ? minPackagingCharge : rawCharge;
  return { rawCharge, finalCharge, minimumChargeApplied: !finalCharge.equals(rawCharge) };
}

/**
 * Spreads one PerGram group's final charge across its member cart lines,
 * proportional to each member's own weight contribution — the largest-
 * remainder-in-cents method, the same technique already proven by
 * bundle-pricing.service.ts::distributeBundleTotal, so the allocated shares
 * always sum to exactly `finalCharge` (never drift by a cent). Members are
 * sorted by itemId first so re-running this twice for the same group always
 * allocates identical cents to identical lines — required so the cart's
 * drift-detection (packagingChargeSnapshot vs. the live-resolved charge)
 * never flaps between two equally-valid splits on successive reads.
 */
export function allocateGroupCharge(
  members: Array<{ itemId: string; weightGrams: number }>,
  finalCharge: Prisma.Decimal,
  groupWeightGrams: number,
): Map<string, number> {
  const sorted = [...members].sort((a, b) => a.itemId.localeCompare(b.itemId));
  const totalCents = finalCharge.times(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();

  if (sorted.length === 0 || groupWeightGrams <= 0) {
    return new Map(sorted.map((member) => [member.itemId, 0]));
  }

  const exactShares = sorted.map((member) => (member.weightGrams / groupWeightGrams) * totalCents);
  const baseShareCents = exactShares.map((share) => Math.floor(share));
  let leftoverCents = totalCents - baseShareCents.reduce((sum, cents) => sum + cents, 0);

  const remainderOrder = exactShares
    .map((share, index) => ({ index, remainder: share - baseShareCents[index] }))
    .sort((a, b) => b.remainder - a.remainder);
  const shareCents = [...baseShareCents];
  for (let i = 0; i < remainderOrder.length && leftoverCents > 0; i += 1) {
    shareCents[remainderOrder[i].index] += 1;
    leftoverCents -= 1;
  }

  return new Map(sorted.map((member, index) => [member.itemId, shareCents[index] / 100]));
}

export interface PackagingSelectionInput {
  packagingOptionId: string;
  declaredAvailability: PackagingDeclaredAvailability;
}

/**
 * DB-backed, throwing. Never trusts the client beyond "which option,
 * which declaration" — re-derives everything else (ownership, eligibility,
 * price) from the DB, mirroring bundle.service.ts's own discipline.
 *
 * `chargeSnapshot` is a per-line TOTAL (not a per-unit rate) for both
 * charge types — see resolvePackagingForCartItems's own header comment for
 * why. For PerGram, `siblingWeightGrams` (the already-fetched weight of any
 * OTHER cart line already sharing this same packagingOptionId) makes the
 * minimum-order-weight check aggregate-aware: a second, lighter variant
 * added under an option that only clears its floor in combination with an
 * existing line must not be wrongly rejected for looking too light on its
 * own. The charge itself stays a provisional, unapportioned value (this
 * line's own weight x rate, no minimum-charge floor applied yet) —
 * buildSummary's very next read is the authoritative correction once every
 * group member exists to allocate across, exactly like Fixed-charge price
 * drift is corrected today.
 */
export async function resolvePackagingSelection(
  productId: string,
  variant: { id: string; netWeightGrams: number } | null,
  quantity: number,
  selection: PackagingSelectionInput,
  siblingWeightGrams: number = 0,
): Promise<{ option: PackagingOptionWithMethod; chargeSnapshot: Prisma.Decimal; netWeightGrams: number | null }> {
  const option = await packagingRepository.findPackagingOptionById(selection.packagingOptionId);
  if (!option) throw new PackagingUnavailableError();
  if (option.productId !== productId) throw new PackagingSelectionInvalidError();
  if (option.variantId !== null && option.variantId !== variant?.id) throw new PackagingSelectionInvalidError();

  const validity = packagingSelectionValidity(option, quantity, selection.declaredAvailability, new Date());
  if (!validity.valid) {
    if (validity.reason === "minimum_quantity") throw new PackagingMinimumQuantityError(option.minQuantity ?? 0);
    if (validity.reason === "availability_mismatch") throw new PackagingAvailabilityMismatchError();
    throw new PackagingUnavailableError();
  }

  if (option.chargeType === "Fixed") {
    return { option, chargeSnapshot: option.charge.times(quantity).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP), netWeightGrams: null };
  }

  // PerGram — requires a resolved variant (enforced at admin-save time:
  // packaging-admin.service.ts only allows PerGram on a product that has
  // variants, so a cart line for such a product always carries one).
  if (!variant) throw new PackagingSelectionInvalidError("This packaging option requires a product variant");

  const thisLineWeightGrams = variant.netWeightGrams * quantity;
  const weightValidity = packagingWeightGroupValidity(siblingWeightGrams + thisLineWeightGrams, option.minOrderWeightGrams);
  if (!weightValidity.valid) throw new PackagingMinimumWeightError(option.minOrderWeightGrams ?? 0);

  const rawCharge = option.ratePerGram!.times(thisLineWeightGrams).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { option, chargeSnapshot: rawCharge, netWeightGrams: thisLineWeightGrams };
}

export interface PackagingResolution {
  /** Live charge (as a plain number) per CartItem.id that currently carries a valid packaging selection — a LINE TOTAL (quantity/weight already folded in), not a per-unit rate, for both Fixed and PerGram. */
  chargeByItemId: Map<string, number>;
  /** CartItem.id values whose packaging selection is no longer valid — those rows flag `unavailable`, never silently re-priced. */
  invalidItemIds: Set<string>;
  requiresManualReviewByItemId: Map<string, boolean>;
  /** Weight-based packaging (Story 3b). This item's own attributed net weight in grams — present only for a valid PerGram selection. */
  netWeightGramsByItemId: Map<string, number>;
  /** Weight-based packaging (Story 3b). Whether this item's group charge was floored by the option's minPackagingCharge. */
  minimumChargeAppliedByItemId: Map<string, boolean>;
}

/**
 * Called once per cart.service.ts::buildSummary read. Pure and
 * synchronous — unlike a bundle instance (whose validity depends on
 * re-pricing every OTHER component), a packaging option's eligibility
 * depends only on its own row, already joined onto each CartItemWithProduct
 * by cart.repository.ts's existing include. No DB round-trip needed here.
 *
 * Deliberately gated on `!item.bundleInstanceId` — packaging never
 * combines with a bundle's exploded rows in this story (see plan).
 *
 * Story 3b (weight-based pricing). After the per-item validity pass above
 * (unchanged), surviving items are grouped by `packagingOptionId` — not by
 * the global PackagingMethod — since each option row already scopes to one
 * product + one rate; a `Fixed` group is priced exactly as before
 * (`charge x quantity`, now expressed as a line total rather than a bare
 * rate). A `PerGram` group sums every member's `netWeightGrams x quantity`
 * into one group weight, checks it against `minOrderWeightGrams`, computes
 * one charge for the whole group (`calculatePerGramCharge`), and spreads it
 * back across members proportional to their own weight contribution
 * (`allocateGroupCharge`) — this is what correctly prices the doc's own
 * worked example of two different variants sharing one whole-product
 * PerGram option as a single 750g charge, not two independent charges.
 */
export function resolvePackagingForCartItems(items: CartItemWithProduct[], now: Date = new Date()): PackagingResolution {
  const chargeByItemId = new Map<string, number>();
  const invalidItemIds = new Set<string>();
  const requiresManualReviewByItemId = new Map<string, boolean>();
  const netWeightGramsByItemId = new Map<string, number>();
  const minimumChargeAppliedByItemId = new Map<string, boolean>();

  const validItems: CartItemWithProduct[] = [];
  for (const item of items) {
    if (!item.packagingOptionId || !item.packagingOption || item.bundleInstanceId) continue;

    if (!item.packagingDeclaredAvailability) {
      invalidItemIds.add(item.id);
      continue;
    }

    const validity = packagingSelectionValidity(item.packagingOption, item.quantity, item.packagingDeclaredAvailability, now);
    if (!validity.valid) {
      invalidItemIds.add(item.id);
      continue;
    }

    validItems.push(item);
  }

  const groups = new Map<string, CartItemWithProduct[]>();
  for (const item of validItems) {
    const key = item.packagingOptionId as string;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  for (const group of groups.values()) {
    const option = group[0].packagingOption!;

    if (option.chargeType === "Fixed") {
      for (const member of group) {
        chargeByItemId.set(member.id, option.charge.times(member.quantity).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber());
        requiresManualReviewByItemId.set(member.id, option.requiresManualReview);
      }
      continue;
    }

    // PerGram. A member without a resolvable (positive) variant weight
    // can't be priced — should never occur, since PerGram is only
    // allowed on a product with variants (packaging-admin.service.ts),
    // but guarded defensively rather than crashing or silently charging
    // zero if variants are ever deleted out from under a live option.
    const weights = group.map((member) => ({ member, weightGrams: (member.variant?.netWeightGrams ?? 0) * member.quantity }));
    if (weights.some((entry) => entry.weightGrams <= 0)) {
      for (const member of group) invalidItemIds.add(member.id);
      continue;
    }

    const groupWeightGrams = weights.reduce((sum, entry) => sum + entry.weightGrams, 0);
    if (!packagingWeightGroupValidity(groupWeightGrams, option.minOrderWeightGrams).valid) {
      for (const member of group) invalidItemIds.add(member.id);
      continue;
    }

    const { finalCharge, minimumChargeApplied } = calculatePerGramCharge(groupWeightGrams, option.ratePerGram!, option.minPackagingCharge);
    const shares = allocateGroupCharge(
      weights.map((entry) => ({ itemId: entry.member.id, weightGrams: entry.weightGrams })),
      finalCharge,
      groupWeightGrams,
    );
    for (const entry of weights) {
      chargeByItemId.set(entry.member.id, shares.get(entry.member.id) ?? 0);
      requiresManualReviewByItemId.set(entry.member.id, option.requiresManualReview);
      netWeightGramsByItemId.set(entry.member.id, entry.weightGrams);
      minimumChargeAppliedByItemId.set(entry.member.id, minimumChargeApplied);
    }
  }

  return { chargeByItemId, invalidItemIds, requiresManualReviewByItemId, netWeightGramsByItemId, minimumChargeAppliedByItemId };
}
