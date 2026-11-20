import { z } from "zod";

// Admin write paths for the homepage "The Perfect Match" section
// (PerfectMatchSetting/PerfectMatchProduct/PerfectMatchPairing) — the
// public storefront read side has no query params to validate (it always
// returns every Published product/pairing), so there's no separate
// perfect-match.schema.ts the way food-academy.schema.ts exists alongside
// food-academy-admin.schema.ts.

/**
 * Same `optionalText()` idiom as food-academy-admin.schema.ts: an
 * untouched admin-form field always submits `""`, never omits the key —
 * normalize `""`/`undefined` to `null` so downstream `?? default` merges
 * never see a stray empty string.
 */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));
}

export const perfectMatchStatusEnum = z.enum(["Draft", "Published"]);

export const perfectMatchSettingAdminSchema = z.object({
  eyebrow: optionalText(80),
  heading: optionalText(150),
  description: optionalText(400),
});

export type PerfectMatchSettingAdminInput = z.infer<typeof perfectMatchSettingAdminSchema>;

export const perfectMatchProductAdminSchema = z.object({
  productId: z.string().min(1),
  tabLabel: optionalText(40),
  kicker: optionalText(120),
  promoDescriptionOverride: optionalText(500),
  isDefaultFeatured: z.boolean().optional().default(false),
  status: perfectMatchStatusEnum.optional(),
});

export type PerfectMatchProductAdminInput = z.infer<typeof perfectMatchProductAdminSchema>;

export const perfectMatchPairingAdminSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: optionalText(300),
  imageUrl: z.string().trim().min(1).max(500),
  imageAlt: optionalText(200),
  categoryLabel: optionalText(60),
  supportingTag: optionalText(80),
  status: perfectMatchStatusEnum.optional(),
});

export type PerfectMatchPairingAdminInput = z.infer<typeof perfectMatchPairingAdminSchema>;

export const perfectMatchReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});
