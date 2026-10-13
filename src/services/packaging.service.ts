import type { Prisma, PackagingAvailability, PackagingDeclaredAvailability } from "@/generated/prisma/client";
import * as packagingRepository from "@/repositories/packaging.repository";
import type { PackagingOptionWithMethod } from "@/repositories/packaging.repository";
import type { CartItemWithProduct } from "@/repositories/cart.repository";
import {
  PackagingAvailabilityMismatchError,
  PackagingMinimumQuantityError,
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

export interface PackagingSelectionInput {
  packagingOptionId: string;
  declaredAvailability: PackagingDeclaredAvailability;
}

/**
 * DB-backed, throwing. Never trusts the client beyond "which option,
 * which declaration" — re-derives everything else (ownership, eligibility,
 * price) from the DB, mirroring bundle.service.ts's own discipline.
 */
export async function resolvePackagingSelection(
  productId: string,
  variantId: string | null,
  quantity: number,
  selection: PackagingSelectionInput,
): Promise<{ option: PackagingOptionWithMethod; chargeSnapshot: Prisma.Decimal }> {
  const option = await packagingRepository.findPackagingOptionById(selection.packagingOptionId);
  if (!option) throw new PackagingUnavailableError();
  if (option.productId !== productId) throw new PackagingSelectionInvalidError();
  if (option.variantId !== null && option.variantId !== variantId) throw new PackagingSelectionInvalidError();

  const validity = packagingSelectionValidity(option, quantity, selection.declaredAvailability, new Date());
  if (!validity.valid) {
    if (validity.reason === "minimum_quantity") throw new PackagingMinimumQuantityError(option.minQuantity ?? 0);
    if (validity.reason === "availability_mismatch") throw new PackagingAvailabilityMismatchError();
    throw new PackagingUnavailableError();
  }

  return { option, chargeSnapshot: option.charge };
}

export interface PackagingResolution {
  /** Live charge (as a plain number) per CartItem.id that currently carries a valid packaging selection. */
  chargeByItemId: Map<string, number>;
  /** CartItem.id values whose packaging selection is no longer valid — those rows flag `unavailable`, never silently re-priced. */
  invalidItemIds: Set<string>;
  requiresManualReviewByItemId: Map<string, boolean>;
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
 */
export function resolvePackagingForCartItems(items: CartItemWithProduct[], now: Date = new Date()): PackagingResolution {
  const chargeByItemId = new Map<string, number>();
  const invalidItemIds = new Set<string>();
  const requiresManualReviewByItemId = new Map<string, boolean>();

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

    chargeByItemId.set(item.id, item.packagingOption.charge.toNumber());
    requiresManualReviewByItemId.set(item.id, item.packagingOption.requiresManualReview);
  }

  return { chargeByItemId, invalidItemIds, requiresManualReviewByItemId };
}
