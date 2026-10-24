import { z } from "zod";

const statLineItemSchema = z.object({
  label: z.string().trim().max(60),
  description: z.string().trim().max(100),
});

export const exportHeroSettingSchema = z.object({
  backgroundImageUrl: z.string().trim().max(500).optional().nullable(),
  backgroundImageAlt: z.string().trim().max(200).optional().nullable(),
  eyebrow: z.string().trim().max(80).optional().nullable(),
  // May contain one **highlighted** span — parsed at render time, never rich text.
  headline: z.string().trim().max(150).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  primaryCtaLabel: z.string().trim().max(60).optional().nullable(),
  primaryCtaHref: z.string().trim().max(300).optional().nullable(),
  secondaryCtaLabel: z.string().trim().max(60).optional().nullable(),
  secondaryCtaHref: z.string().trim().max(300).optional().nullable(),
  statLine: z.array(statLineItemSchema).max(6).optional().nullable(),
  badgeEyebrow: z.string().trim().max(80).optional().nullable(),
  badgeHeadline: z.string().trim().max(150).optional().nullable(),
  badgeDescription: z.string().trim().max(300).optional().nullable(),
  badgeCtaLabel: z.string().trim().max(60).optional().nullable(),
  badgeCtaHref: z.string().trim().max(300).optional().nullable(),
});

export type ExportHeroSettingInput = z.infer<typeof exportHeroSettingSchema>;
