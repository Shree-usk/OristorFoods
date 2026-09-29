import { prisma } from "../src/lib/db";

/**
 * Referral Programme seed (STORY-031). Unlike RewardSetting, this row is
 * NOT left absent — an unconfigured referral program pays out nothing at
 * all, so it ships with real working defaults. Minimum order value and
 * the referred customer's welcome bonus stay null (genuinely optional
 * per the AC's own "if any" wording). The admin CRUD for these values is
 * STORY-049.
 */
export async function seedReferrals() {
  await prisma.referralSetting.create({
    data: { id: "global", referrerBonusPoints: 100, attributionWindowDays: 30 },
  });

  return { referrerBonusPoints: 100, attributionWindowDays: 30 };
}
