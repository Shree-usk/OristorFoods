import * as referralRepository from "@/repositories/referral.repository";
import * as rewardsRepository from "@/repositories/rewards.repository";
import { getOrCreateReferralCode, getReferralStatusForUser } from "@/services/referral.service";

/**
 * STORY-035. Presentation-only composition for `/account/referrals` —
 * reads and formats what STORY-031's referral.service.ts already
 * computes; no referral-crediting or reward-value rule is defined here.
 */

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local[0]}***@${domain}`;
}

export type ReferredFriendStatus = "Signed Up" | "Reward Earned";

export interface ReferredFriend {
  displayName: string;
  maskedEmail: string | null;
  status: ReferredFriendStatus;
  createdAt: string;
  qualifiedAt: string | null;
}

/**
 * `Excluded` attributions (self-referrals) are filtered out — they never
 * happened as far as the referring customer should see. The engine's
 * two real states (Registered/Qualified) map onto the AC's funnel as
 * "Signed Up"/"Reward Earned" — there's no third, distinct "first
 * purchase completed but reward not yet earned" state in the data model:
 * qualification and the bonus credit happen atomically together
 * (referral.service.ts::handleQualifyingCheck). See
 * docs/architecture-decisions.md.
 */
export async function getReferredFriends(userId: string): Promise<ReferredFriend[]> {
  const entries = await getReferralStatusForUser(userId);
  return entries
    .filter((entry) => entry.status !== "Excluded")
    .map((entry) => ({
      displayName: entry.referredName?.trim() || "A friend",
      maskedEmail: maskEmail(entry.referredEmail),
      status: entry.status === "Qualified" ? "Reward Earned" : "Signed Up",
      createdAt: entry.createdAt,
      qualifiedAt: entry.qualifiedAt,
    }));
}

export interface ReferralSummary {
  code: string;
  link: string;
  /** Net points earned from referring others (ReferralBonus - ReferralBonusReversed) — not the welcome bonus this user may have received for being referred themselves. */
  totalPointsEarned: number;
  /** Points the customer earns per successful referral, for messaging — null if referrals currently pay no bonus. */
  referrerBonusPoints: number | null;
}

export async function getReferralSummary(userId: string): Promise<ReferralSummary> {
  const [code, setting, bonusPoints] = await Promise.all([
    getOrCreateReferralCode(userId),
    referralRepository.getSetting(),
    rewardsRepository.sumPointsByTypes(userId, ["ReferralBonus", "ReferralBonusReversed"]),
  ]);

  const link = new URL("/", process.env.NEXT_PUBLIC_SITE_URL ?? "https://oristor.com");
  link.searchParams.set("ref", code);

  return {
    code,
    link: link.toString(),
    totalPointsEarned: bonusPoints,
    referrerBonusPoints: setting?.referrerBonusPoints ?? null,
  };
}
