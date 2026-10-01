import { randomBytes } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { readReferralCookie } from "@/lib/api/referral-cookie";
import { verifyReferralToken } from "@/lib/referral-token";
import * as orderRepository from "@/repositories/order.repository";
import * as referralRepository from "@/repositories/referral.repository";
import * as rewardsRepository from "@/repositories/rewards.repository";
import { checkReferralVelocity, checkSharedAddress } from "@/services/fraud-detection.service";
import { sendNotification } from "@/services/notification.service";
import type { OrderEventConsumer } from "@/services/order-integration.service";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";

/**
 * Referral Programme (STORY-031): code generation, attribution-cookie
 * verification at registration, and qualifying-order payout via
 * STORY-030's reward ledger. Reward VALUES (bonus amount, minimum
 * qualifying order value, attribution window) are admin-configurable
 * (STORY-049 will own the authoring UI) — see ReferralSetting in
 * prisma/schema.prisma, seeded with working defaults in
 * prisma/seed-referrals.ts.
 *
 * Payout is points-only. coupon.repository.ts has no function to
 * programmatically create a new Coupon row (confirmed during planning) —
 * building one is separate scope, mirroring STORY-030's own "no second
 * earning mode without a concrete admin UI to configure it" precedent.
 */

const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 8;
const CODE_MAX_ATTEMPTS = 5;
const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 30;

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}

/** Lazy generate-or-return — used both by registration (eager) and the read endpoint (existing customers). */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = await referralRepository.findCodeByUserId(userId);
  if (existing) return existing.code;

  for (let attempt = 0; attempt < CODE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const created = await referralRepository.createCode(userId, generateCode());
      return created.code;
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      // Either a concurrent call already created this user's code, or the
      // generated code collided with someone else's — check which.
      const winner = await referralRepository.findCodeByUserId(userId);
      if (winner) return winner.code;
    }
  }
  throw new Error("Could not generate a unique referral code after several attempts");
}

/**
 * Reads the signed attribution cookie (if any) and, if it still resolves
 * to a valid referrer within the configured window, records the
 * ReferralAttribution — exactly once, since this only ever runs at
 * registration. Never throws outward: referral attribution is a
 * best-effort side effect of signing up, never a reason to fail account
 * creation, and an unknown/expired code silently means no attribution,
 * per the AC.
 */
export async function attributeReferralAtRegistration(newUser: { id: string; email: string | null }, request: Request): Promise<void> {
  try {
    const payload = await verifyReferralToken(readReferralCookie(request));
    if (!payload) return;

    const setting = await referralRepository.getSetting();
    const windowDays = setting?.attributionWindowDays ?? DEFAULT_ATTRIBUTION_WINDOW_DAYS;
    if (Date.now() - payload.ts > windowDays * 24 * 60 * 60 * 1000) return; // window elapsed

    const codeRow = await referralRepository.findCodeByCode(payload.code);
    if (!codeRow) return; // unknown/deactivated code
    if (codeRow.userId === newUser.id) return; // structurally shouldn't happen, defensive

    const isSelfReferral = Boolean(codeRow.user.email && newUser.email && codeRow.user.email.toLowerCase() === newUser.email.toLowerCase());
    const welcomeBonus = setting?.referredWelcomeBonusPoints ?? 0;

    const attribution = await prisma.$transaction(async (tx) => {
      const created = await referralRepository.createAttribution(
        {
          referrerUserId: codeRow.userId,
          referredUserId: newUser.id,
          status: isSelfReferral ? "Excluded" : "Registered",
          excludedReason: isSelfReferral ? "self_referral" : null,
        },
        tx,
      );

      if (!isSelfReferral && welcomeBonus > 0) {
        await rewardsRepository.getOrCreateAccount(tx, newUser.id);
        await rewardsRepository.createTransaction(tx, { userId: newUser.id, type: "ReferralWelcomeBonus", points: welcomeBonus, orderId: null });
      }
      return created;
    });

    // STORY-049: best-effort fraud check, never a reason to fail registration — same framing as this whole function's own catch below.
    if (!isSelfReferral) {
      try {
        await checkReferralVelocity(codeRow.userId, attribution.id);
      } catch (fraudCheckError) {
        console.error("[referral] referral-velocity fraud check failed", fraudCheckError);
      }
    }
  } catch (error) {
    console.error("[referral] failed to record attribution at registration", error);
  }
}

async function handleQualifyingCheck(orderId: string, referredUserId: string): Promise<void> {
  const attribution = await referralRepository.findAttributionByReferredUserId(referredUserId);
  if (!attribution || attribution.status !== "Registered") return; // not referred, already qualified, or excluded

  const order = await orderRepository.findOrderById(orderId);
  if (!order) return;

  const setting = await referralRepository.getSetting();
  const minValue = setting?.minQualifyingOrderValue?.toNumber() ?? null;
  if (minValue !== null && order.subtotal.toNumber() < minValue) return; // below the configured minimum — stays Registered

  const bonusPoints = setting?.referrerBonusPoints ?? 0;
  try {
    await prisma.$transaction(async (tx) => {
      await referralRepository.markQualified(attribution.id, orderId, tx);
      if (bonusPoints > 0) {
        await rewardsRepository.getOrCreateAccount(tx, attribution.referrerUserId);
        await rewardsRepository.createTransaction(tx, { userId: attribution.referrerUserId, type: "ReferralBonus", points: bonusPoints, orderId });
      }
    });
    // STORY-032: only on a genuine new qualification — never the
    // idempotent-replay branch below.
    await sendNotification({
      userId: attribution.referrerUserId,
      templateKey: "referral.qualified",
      variables: { points: bonusPoints },
      triggeringEventId: attribution.id,
    });

    // STORY-049: best-effort fraud check — a real shipping address now
    // exists to compare (unlike at registration, where a brand-new
    // customer typically has none saved yet). Never a reason to fail
    // the qualification above, which has already committed.
    try {
      const bonusTransaction = bonusPoints > 0 ? await rewardsRepository.findTransactionByOrderAndType(orderId, "ReferralBonus") : null;
      await checkSharedAddress(attribution.referrerUserId, { shipLine1: order.shipLine1, shipCity: order.shipCity }, attribution.id, bonusTransaction?.id ?? null);
    } catch (fraudCheckError) {
      console.error("[referral] shared-address fraud check failed", fraudCheckError);
    }
  } catch (error) {
    // Already qualified for this order (a replayed event) — idempotent
    // no-op. The status guard above already prevents this in practice;
    // this is defense-in-depth against a genuine race.
    if (!isUniqueConstraintViolation(error)) throw error;
  }
}

async function handleCancellationReversal(orderId: string): Promise<void> {
  const attribution = await referralRepository.findAttributionByQualifyingOrderId(orderId);
  if (!attribution) return; // this cancelled order never triggered a referral bonus

  const bonusTransaction = await rewardsRepository.findTransactionByOrderAndType(orderId, "ReferralBonus");
  if (!bonusTransaction) {
    // Qualified with no payout configured at the time — just revert status, nothing to reverse in the ledger.
    await referralRepository.revertQualification(attribution.id);
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await referralRepository.revertQualification(attribution.id, tx);
      await rewardsRepository.createTransaction(tx, {
        userId: attribution.referrerUserId,
        type: "ReferralBonusReversed",
        points: -bonusTransaction.points,
        orderId,
      });
    });
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
  }
}

// --- order.confirmed / order.cancelled consumer (STORY-028's hook, fanned out per STORY-031's fix to order-integration.service.ts) ---

export const referralConsumer: OrderEventConsumer = {
  async onOrderEvent(_eventId, type, orderId, payload) {
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    if (!userId) return; // a guest order can't be the referred side of an attribution

    if (type === "order.confirmed") {
      await handleQualifyingCheck(orderId, userId);
    } else if (type === "order.cancelled") {
      await handleCancellationReversal(orderId);
    }
  },
};

// --- Reads (the API below, and STORY-035's future dashboard) ---

export interface ReferralStatusEntry {
  referredName: string | null;
  referredEmail: string | null;
  status: "Registered" | "Qualified" | "Excluded";
  qualifiedAt: string | null;
  createdAt: string;
}

export async function getReferralStatusForUser(userId: string): Promise<ReferralStatusEntry[]> {
  const rows = await referralRepository.listAttributionsForReferrer(userId);
  return rows.map((row) => ({
    referredName: row.referred.name,
    referredEmail: row.referred.email,
    status: row.status,
    qualifiedAt: row.qualifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

// --- STORY-049. Admin Rewards & Referrals console: referral rule config ---

export interface UpdateReferralSettingInput {
  referrerBonusPoints?: number | null;
  minQualifyingOrderValue?: number | null;
  attributionWindowDays?: number | null;
  referredWelcomeBonusPoints?: number | null;
  maxReferralsPerPeriod?: number | null;
  referralPeriodDays?: number | null;
}

export async function updateReferralSetting(adminUserId: string, input: UpdateReferralSettingInput) {
  await requirePermission(adminUserId, "RewardsReferrals", "Edit");
  const updated = await referralRepository.updateSetting({
    ...(input.referrerBonusPoints !== undefined ? { referrerBonusPoints: input.referrerBonusPoints } : {}),
    ...(input.minQualifyingOrderValue !== undefined ? { minQualifyingOrderValue: input.minQualifyingOrderValue?.toFixed(2) ?? null } : {}),
    ...(input.attributionWindowDays !== undefined ? { attributionWindowDays: input.attributionWindowDays } : {}),
    ...(input.referredWelcomeBonusPoints !== undefined ? { referredWelcomeBonusPoints: input.referredWelcomeBonusPoints } : {}),
    ...(input.maxReferralsPerPeriod !== undefined ? { maxReferralsPerPeriod: input.maxReferralsPerPeriod } : {}),
    ...(input.referralPeriodDays !== undefined ? { referralPeriodDays: input.referralPeriodDays } : {}),
  });
  await writeAuditLog({ actorId: adminUserId, action: "referral_setting_updated", module: "RewardsReferrals", targetType: "ReferralSetting", targetId: "global" });
  return updated;
}
