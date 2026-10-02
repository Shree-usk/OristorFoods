import { z } from "zod";

import { customerGroupEnum } from "@/validation/pricing.schema";

const popupPageTargetEnum = z.enum(["AllPages", "Homepage", "Products", "Recipes", "Blog"]);
const popupAudienceTargetEnum = z.enum(["AllVisitors", "NewVisitors", "ReturningVisitors", "Authenticated", "CustomerGroupTarget", "LoyaltyMembers", "ReferralMembers"]);
const popupTriggerTypeEnum = z.enum(["Immediate", "TimeDelay", "ScrollDepth", "ExitIntent", "PageViews", "AddToCart", "BeforeCheckout"]);
const popupFrequencyCapEnum = z.enum(["OncePerSession", "OncePerDay", "OncePerWeek", "OncePerCustomer", "UntilDismissed"]);
export const popupStatusEnum = z.enum(["Draft", "Scheduled", "Published", "Paused", "Unpublished", "Archived"]);

export const popupSchema = z
  .object({
    name: z.string().trim().min(1),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1).nullable().optional(),
    imageUrl: z.string().trim().min(1).nullable().optional(),
    imageAlt: z.string().trim().min(1).nullable().optional(),
    mobileImageUrl: z.string().trim().min(1).nullable().optional(),
    mobileImageAlt: z.string().trim().min(1).nullable().optional(),
    videoUrl: z.string().trim().min(1).nullable().optional(),
    ctaLabel: z.string().trim().min(1).nullable().optional(),
    ctaHref: z.string().trim().min(1).nullable().optional(),
    secondaryCtaLabel: z.string().trim().min(1).nullable().optional(),
    secondaryCtaHref: z.string().trim().min(1).nullable().optional(),
    couponCode: z.string().trim().min(1).nullable().optional(),
    pageTarget: popupPageTargetEnum,
    audienceTarget: popupAudienceTargetEnum,
    targetCustomerGroup: customerGroupEnum.nullable().optional(),
    triggerType: popupTriggerTypeEnum,
    triggerValue: z.number().int().nullable().optional(),
    frequencyCap: popupFrequencyCapEnum,
    startAt: z.coerce.date().nullable().optional(),
    endAt: z.coerce.date().nullable().optional(),
    variantGroupId: z.string().trim().min(1).nullable().optional(),
    variantWeight: z.number().int().positive().default(100),
  })
  .refine((data) => !data.startAt || !data.endAt || data.endAt > data.startAt, { message: "End date must be after the start date.", path: ["endAt"] })
  .refine((data) => data.audienceTarget !== "CustomerGroupTarget" || data.targetCustomerGroup, { message: "Select a customer group.", path: ["targetCustomerGroup"] })
  .refine((data) => data.triggerType !== "ScrollDepth" || (data.triggerValue !== undefined && data.triggerValue !== null && data.triggerValue >= 0 && data.triggerValue <= 100), {
    message: "Scroll depth must be 0-100.",
    path: ["triggerValue"],
  })
  .refine((data) => !["TimeDelay", "PageViews"].includes(data.triggerType) || (data.triggerValue !== undefined && data.triggerValue !== null && data.triggerValue > 0), {
    message: "A positive value is required for this trigger type.",
    path: ["triggerValue"],
  });

export const popupUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).nullable().optional(),
  imageUrl: z.string().trim().min(1).nullable().optional(),
  imageAlt: z.string().trim().min(1).nullable().optional(),
  mobileImageUrl: z.string().trim().min(1).nullable().optional(),
  mobileImageAlt: z.string().trim().min(1).nullable().optional(),
  videoUrl: z.string().trim().min(1).nullable().optional(),
  ctaLabel: z.string().trim().min(1).nullable().optional(),
  ctaHref: z.string().trim().min(1).nullable().optional(),
  secondaryCtaLabel: z.string().trim().min(1).nullable().optional(),
  secondaryCtaHref: z.string().trim().min(1).nullable().optional(),
  couponCode: z.string().trim().min(1).nullable().optional(),
  pageTarget: popupPageTargetEnum.optional(),
  audienceTarget: popupAudienceTargetEnum.optional(),
  targetCustomerGroup: customerGroupEnum.nullable().optional(),
  triggerType: popupTriggerTypeEnum.optional(),
  triggerValue: z.number().int().nullable().optional(),
  frequencyCap: popupFrequencyCapEnum.optional(),
  startAt: z.coerce.date().nullable().optional(),
  endAt: z.coerce.date().nullable().optional(),
  variantGroupId: z.string().trim().min(1).nullable().optional(),
  variantWeight: z.number().int().positive().optional(),
});

export const updatePopupStatusSchema = z.object({
  status: popupStatusEnum,
});

export const popupPageTargetQuerySchema = popupPageTargetEnum;

export const recordInteractionSchema = z.object({
  type: z.enum(["Impression", "Click", "Dismissal"]),
});
