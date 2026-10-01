import { z } from "zod";

export const updateReferralSettingSchema = z.object({
  referrerBonusPoints: z.number().int().positive().nullable().optional(),
  minQualifyingOrderValue: z.number().positive().nullable().optional(),
  attributionWindowDays: z.number().int().positive().nullable().optional(),
  referredWelcomeBonusPoints: z.number().int().positive().nullable().optional(),
  maxReferralsPerPeriod: z.number().int().positive().nullable().optional(),
  referralPeriodDays: z.number().int().positive().nullable().optional(),
});
