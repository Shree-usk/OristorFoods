import { z } from "zod";

import { customerGroupEnum } from "@/validation/pricing.schema";

/** STORY-050d. Validation for the admin email/SMS/WhatsApp campaign endpoints. */

const notificationChannelEnum = z.enum(["Email", "SMS", "WhatsApp"]);
const campaignAudienceTargetEnum = z.enum(["AllCustomers", "CustomerGroupTarget", "LoyaltyMembers", "ReferralMembers", "SavedSegment"]);

export const campaignSchema = z
  .object({
    name: z.string().trim().min(1),
    channel: notificationChannelEnum,
    audienceTarget: campaignAudienceTargetEnum,
    targetCustomerGroup: customerGroupEnum.nullable().optional(),
    // STORY-059a.
    targetSegmentId: z.string().trim().min(1).nullable().optional(),
    subject: z.string().trim().min(1).nullable().optional(),
    body: z.string().trim().min(1),
    scheduledAt: z.coerce.date().nullable().optional(),
  })
  .refine((data) => data.channel !== "Email" || (data.subject !== undefined && data.subject !== null && data.subject.trim().length > 0), {
    message: "A subject is required for an email campaign.",
    path: ["subject"],
  })
  .refine((data) => data.audienceTarget !== "CustomerGroupTarget" || data.targetCustomerGroup, { message: "Select a customer group.", path: ["targetCustomerGroup"] })
  .refine((data) => data.audienceTarget !== "SavedSegment" || data.targetSegmentId, { message: "Select a saved segment.", path: ["targetSegmentId"] });

export const campaignUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  channel: notificationChannelEnum.optional(),
  audienceTarget: campaignAudienceTargetEnum.optional(),
  targetCustomerGroup: customerGroupEnum.nullable().optional(),
  // STORY-059a.
  targetSegmentId: z.string().trim().min(1).nullable().optional(),
  subject: z.string().trim().min(1).nullable().optional(),
  body: z.string().trim().min(1).optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
});
