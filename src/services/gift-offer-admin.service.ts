import { Prisma } from "@/generated/prisma/client";
import * as giftOfferRepository from "@/repositories/gift-offer.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { GiftOfferAdminNotFoundError, GiftOfferProductAlreadyHasOfferError } from "@/services/gift-offer-admin.errors";
import { requirePermission } from "@/services/permission.service";
import type { CreateGiftOfferFormInput, UpdateGiftOfferFormInput } from "@/validation/gift-offer-admin.schema";

/**
 * Admin CRUD for GiftOffer (Story 5 — Free Gift, Option C). A standalone
 * Marketing-module campaign entity (own list + create/edit, same shape as
 * Coupon/Promotion) rather than a per-product tab like ProductBundle —
 * see the approved plan's Section 5 for why. Permission module is
 * "Marketing", matching Coupon/Promotion admin, not "Products".
 */

function isUniqueConstraintViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isRelationViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2014";
}

/**
 * Same adapter-shape gotcha bundle-admin.service.ts's own copy documents
 * — @prisma/adapter-pg reports the violated field under a different path
 * than Prisma's docs describe, and the 1:1 `product.connect` relation
 * (GiftOffer.productId @unique, mirroring ProductBundle.productId) fails
 * with P2014 (a relation-cardinality violation), not P2002 — Prisma's
 * query engine checks this before the DB-level unique constraint ever
 * gets a chance to fire.
 */
function conflictField(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const meta = error.meta as { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } } | undefined;
  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields) && typeof adapterFields[0] === "string") return adapterFields[0].replace(/^"|"$/g, "");
  const target = meta?.target;
  if (Array.isArray(target)) return target[0] as string;
  if (typeof target === "string") return target;
  return undefined;
}

export async function listGiftOffersForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return giftOfferRepository.listGiftOffersForAdmin();
}

async function requireGiftOfferRow(id: string) {
  const offer = await giftOfferRepository.findGiftOfferById(id);
  if (!offer) throw new GiftOfferAdminNotFoundError();
  return offer;
}

export async function getGiftOfferAdminDetail(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return requireGiftOfferRow(id);
}

export async function createGiftOffer(adminUserId: string, input: CreateGiftOfferFormInput) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  const { productId, giftProductId, giftVariantId, ...rest } = input;
  try {
    const offer = await giftOfferRepository.createGiftOffer({
      ...rest,
      description: rest.description ?? null,
      status: rest.status ?? "Active",
      startDate: rest.startDate ?? null,
      endDate: rest.endDate ?? null,
      minQuantity: rest.minQuantity ?? null,
      minSpend: rest.minSpend ?? null,
      giftQuantity: rest.giftQuantity ?? 1,
      giftStockLimit: rest.giftStockLimit ?? null,
      redemptionLimitGlobal: rest.redemptionLimitGlobal ?? null,
      redemptionLimitPerCustomer: rest.redemptionLimitPerCustomer ?? null,
      stackable: rest.stackable ?? false,
      product: { connect: { id: productId } },
      giftProduct: { connect: { id: giftProductId } },
      giftVariant: giftVariantId ? { connect: { id: giftVariantId } } : undefined,
    });
    await writeAuditLog({ actorId: adminUserId, action: "gift_offer_created", module: "Marketing", targetType: "Product", targetId: productId, metadata: { giftOfferId: offer.id } });
    return offer;
  } catch (error) {
    if (isUniqueConstraintViolation(error) && conflictField(error) === "productId") throw new GiftOfferProductAlreadyHasOfferError();
    if (isRelationViolation(error)) throw new GiftOfferProductAlreadyHasOfferError();
    throw error;
  }
}

export async function updateGiftOffer(adminUserId: string, id: string, input: UpdateGiftOfferFormInput) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  await requireGiftOfferRow(id);
  const { giftProductId, giftVariantId, ...rest } = input;
  const offer = await giftOfferRepository.updateGiftOffer(id, {
    ...rest,
    ...(giftProductId !== undefined && { giftProduct: { connect: { id: giftProductId } } }),
    ...(giftVariantId !== undefined && { giftVariant: giftVariantId ? { connect: { id: giftVariantId } } : { disconnect: true } }),
  });
  await writeAuditLog({ actorId: adminUserId, action: "gift_offer_updated", module: "Marketing", targetType: "Product", targetId: offer.productId, metadata: { giftOfferId: id } });
  return offer;
}
