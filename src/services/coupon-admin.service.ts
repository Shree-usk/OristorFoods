import * as couponRepository from "@/repositories/coupon.repository";
import type { CreateCouponInput, CreatePromotionInput, UpdateCouponInput, UpdatePromotionInput } from "@/repositories/coupon.repository";
import { CouponAdminNotFoundError, CouponCodeTakenError, PromotionNotFoundError } from "@/services/coupon.errors";
import { isUniqueCodeViolation } from "@/services/coupon.service";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-050b. Admin CRUD over the Coupon/Promotion models STORY-029
 * already defines and discount.service.ts already reads live at
 * checkout — this file only adds the missing admin surface, no new
 * discount-resolution logic. Permission gating reuses the plain
 * View/Edit shape every other admin console this session built
 * already uses (see popup.service.ts) — no Approve tier here, since
 * unlike a popup's publish step, a coupon/promotion has no distinct
 * "make it live" action beyond isActive + its own date range, which
 * has worked this way since STORY-029.
 */

// --- Coupons ---

export async function listCouponsForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return couponRepository.listCouponsForAdmin();
}

async function requireCouponRow(id: string) {
  const coupon = await couponRepository.findCouponById(id);
  if (!coupon || coupon.restrictedToUserId) throw new CouponAdminNotFoundError();
  return coupon;
}

export async function getCouponAdminDetail(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return requireCouponRow(id);
}

export async function createCoupon(adminUserId: string, input: Omit<CreateCouponInput, "restrictedToUserId">) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  try {
    const coupon = await couponRepository.createCoupon({ ...input, restrictedToUserId: null });
    await writeAuditLog({ actorId: adminUserId, action: "coupon_created", module: "Marketing", targetType: "Coupon", targetId: coupon.id, metadata: { code: coupon.code } });
    return coupon;
  } catch (error) {
    if (isUniqueCodeViolation(error)) throw new CouponCodeTakenError();
    throw error;
  }
}

export async function updateCoupon(adminUserId: string, id: string, input: UpdateCouponInput) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  await requireCouponRow(id);
  const coupon = await couponRepository.updateCoupon(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "coupon_updated", module: "Marketing", targetType: "Coupon", targetId: id });
  return coupon;
}

// --- Promotions ---

export async function listPromotionsForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return couponRepository.listPromotionsForAdmin();
}

async function requirePromotionRow(id: string) {
  const promotion = await couponRepository.findPromotionById(id);
  if (!promotion) throw new PromotionNotFoundError();
  return promotion;
}

export async function getPromotionAdminDetail(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "Marketing", "View");
  return requirePromotionRow(id);
}

export async function createPromotion(adminUserId: string, input: CreatePromotionInput) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  const promotion = await couponRepository.createPromotion(input);
  await writeAuditLog({ actorId: adminUserId, action: "promotion_created", module: "Marketing", targetType: "Promotion", targetId: promotion.id });
  return promotion;
}

export async function updatePromotion(adminUserId: string, id: string, input: UpdatePromotionInput) {
  await requirePermission(adminUserId, "Marketing", "Edit");
  await requirePromotionRow(id);
  const promotion = await couponRepository.updatePromotion(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "promotion_updated", module: "Marketing", targetType: "Promotion", targetId: id });
  return promotion;
}
