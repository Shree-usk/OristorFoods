import * as addressRepository from "@/repositories/address.repository";
import * as fraudFlagRepository from "@/repositories/fraud-flag.repository";
import * as referralRepository from "@/repositories/referral.repository";
import * as rewardsRepository from "@/repositories/rewards.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { FraudFlagNotFoundError, FraudFlagNotPendingError } from "@/services/fraud-detection.errors";
import { requirePermission } from "@/services/permission.service";
import { reverseTransaction } from "@/services/rewards.service";

/**
 * STORY-049. Real, scoped rule-based heuristics against data that
 * already exists — never blocking the customer action that triggers
 * them (mirrors this codebase's existing "never block the primary
 * action on a side-effect check" precedent: STORY-034's address-save
 * during checkout, STORY-031's referral attribution itself). "Shared
 * payment method" from the AC is explicitly not implementable — the
 * payment gateway is still "mock," no real card data exists to
 * fingerprint (blueprint Section 10, same unconfirmed-provider flag
 * STORY-026/047 already established) — not silently dropped, just
 * never attempted. These heuristics are also the concrete candidates
 * flagged for future AI-assisted scoring (STORY-064) per the AC.
 */

const REDEMPTION_VELOCITY_WINDOW_DAYS = 7;
const REDEMPTION_VELOCITY_THRESHOLD_POINTS = 2000;

function normalizeAddressKey(line1: string, city: string): string {
  return `${line1.trim().toLowerCase()}|${city.trim().toLowerCase()}`;
}

/**
 * Checked at the referral's QUALIFYING step (handleQualifyingCheck), not
 * at registration — a brand-new customer has no saved address yet, so
 * checking at registration would almost never find anything. By
 * qualification time, the referred customer has placed a real order
 * with a real shipping address to compare against the referrer's own
 * saved address book.
 */
export async function checkSharedAddress(
  referrerUserId: string,
  referredOrder: { shipLine1: string; shipCity: string },
  attributionId: string,
  relatedRewardTransactionId: string | null,
): Promise<void> {
  const referrerAddresses = await addressRepository.listAddressesByUserId(referrerUserId);
  if (referrerAddresses.length === 0) return;

  const referredKey = normalizeAddressKey(referredOrder.shipLine1, referredOrder.shipCity);
  const matched = referrerAddresses.some((address) => normalizeAddressKey(address.line1, address.city) === referredKey);
  if (!matched) return;

  await fraudFlagRepository.createFlag({
    customerId: referrerUserId,
    type: "referral_shared_address",
    details: { shipLine1: referredOrder.shipLine1, shipCity: referredOrder.shipCity },
    relatedReferralAttributionId: attributionId,
    relatedRewardTransactionId,
  });
}

/** Checked at attribution creation (registration) — a count of recent referrals, independent of any order. */
export async function checkReferralVelocity(referrerUserId: string, attributionId: string): Promise<void> {
  const setting = await referralRepository.getSetting();
  if (!setting?.maxReferralsPerPeriod || !setting?.referralPeriodDays) return; // either half of the pair unset = this check is off

  const since = new Date(Date.now() - setting.referralPeriodDays * 24 * 60 * 60 * 1000);
  const count = await referralRepository.countAttributionsByReferrerSince(referrerUserId, since);
  if (count <= setting.maxReferralsPerPeriod) return;

  await fraudFlagRepository.createFlag({
    customerId: referrerUserId,
    type: "referral_velocity",
    details: { count, threshold: setting.maxReferralsPerPeriod, periodDays: setting.referralPeriodDays },
    relatedReferralAttributionId: attributionId,
  });
}

/**
 * Checked after a successful order redeems points — a fixed window/
 * threshold, not admin-configurable (the AC asks for a referral
 * fraud-threshold setting specifically, not a separate redemption one).
 */
export async function checkRedemptionVelocity(userId: string): Promise<void> {
  const since = new Date(Date.now() - REDEMPTION_VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const redeemed = Math.abs(await rewardsRepository.sumRedeemedPointsSince(userId, since));
  if (redeemed <= REDEMPTION_VELOCITY_THRESHOLD_POINTS) return;

  await fraudFlagRepository.createFlag({
    customerId: userId,
    type: "redemption_velocity",
    details: { redeemed, windowDays: REDEMPTION_VELOCITY_WINDOW_DAYS, threshold: REDEMPTION_VELOCITY_THRESHOLD_POINTS },
  });
}

// --- Admin review queue ---

export async function listFraudFlags(adminUserId: string, status: "Pending" | "Approved" | "Reversed" | undefined, page: number, pageSize: number) {
  await requirePermission(adminUserId, "RewardsReferrals", "View");
  return fraudFlagRepository.listFlags(status, page, pageSize);
}

async function requirePendingFlag(id: string) {
  const flag = await fraudFlagRepository.findFlagById(id);
  if (!flag) throw new FraudFlagNotFoundError();
  if (flag.status !== "Pending") throw new FraudFlagNotPendingError();
  return flag;
}

/** Dismisses the flag as reviewed-and-fine — no reward change. */
export async function approveFlag(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "RewardsReferrals", "Approve");
  await requirePendingFlag(id);

  const resolved = await fraudFlagRepository.resolveFlag(id, "Approved", adminUserId);
  await writeAuditLog({ actorId: adminUserId, action: "fraud_flag_approved", module: "RewardsReferrals", targetType: "FraudFlag", targetId: id });
  return resolved;
}

/** Claws back the related reward transaction, when there is one, then resolves the flag. */
export async function reverseFlag(adminUserId: string, id: string, note: string) {
  await requirePermission(adminUserId, "RewardsReferrals", "Approve");
  const flag = await requirePendingFlag(id);

  if (flag.relatedRewardTransactionId) {
    await reverseTransaction(flag.relatedRewardTransactionId, note);
  }

  const resolved = await fraudFlagRepository.resolveFlag(id, "Reversed", adminUserId);
  await writeAuditLog({ actorId: adminUserId, action: "fraud_flag_reversed", module: "RewardsReferrals", targetType: "FraudFlag", targetId: id, metadata: { note } });
  return resolved;
}
