import { z } from "zod";

export const seasonalCampaignStatusEnum = z.enum(["Draft", "Scheduled", "Active", "Ended", "Archived"]);

export const seasonalCampaignSchema = z
  .object({
    name: z.string().trim().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    popupId: z.string().trim().min(1).nullable().optional(),
    couponId: z.string().trim().min(1).nullable().optional(),
    emailSmsCampaignId: z.string().trim().min(1).nullable().optional(),
    homepageSectionId: z.string().trim().min(1).nullable().optional(),
  })
  .refine((data) => data.endDate > data.startDate, { message: "End date must be after the start date.", path: ["endDate"] });

export const seasonalCampaignUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  popupId: z.string().trim().min(1).nullable().optional(),
  couponId: z.string().trim().min(1).nullable().optional(),
  emailSmsCampaignId: z.string().trim().min(1).nullable().optional(),
  homepageSectionId: z.string().trim().min(1).nullable().optional(),
});

export const updateSeasonalCampaignStatusSchema = z.object({
  status: seasonalCampaignStatusEnum,
});
