import { z } from "zod";

import { EXPORT_ICON_OPTIONS } from "@/lib/export-icons";

const exportIconSchema = z.string().refine((name) => name in EXPORT_ICON_OPTIONS, "Unknown icon.");

/** An empty string from a cleared form field means "unset" — stored as SQL NULL, not "". Same convention company-settings/export-hero-admin schemas already use. */
const emptyToNull = (value: unknown) => (value === "" ? null : value);

export const exportPageHeroSettingSchema = z.object({
  backgroundImageUrl: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  backgroundImageAlt: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  eyebrow: z.preprocess(emptyToNull, z.string().trim().min(1).max(100).nullable().optional()),
  headline: z.preprocess(emptyToNull, z.string().trim().min(1).max(200).nullable().optional()),
  description: z.preprocess(emptyToNull, z.string().trim().min(1).max(500).nullable().optional()),
  primaryCtaLabel: z.preprocess(emptyToNull, z.string().trim().min(1).max(60).nullable().optional()),
  primaryCtaHref: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
  secondaryCtaLabel: z.preprocess(emptyToNull, z.string().trim().min(1).max(60).nullable().optional()),
  secondaryCtaHref: z.preprocess(emptyToNull, z.string().trim().min(1).nullable().optional()),
});

export const exportSolutionCardSchema = z.object({
  icon: exportIconSchema,
  title: z.string().trim().min(1, "Title is required.").max(100),
  description: z.string().trim().min(1, "Description is required.").max(300),
  visible: z.boolean().default(true),
});

export const updateExportSolutionCardSchema = z.object({
  icon: exportIconSchema.optional(),
  title: z.string().trim().min(1, "Title is required.").max(100).optional(),
  description: z.string().trim().min(1, "Description is required.").max(300).optional(),
  visible: z.boolean().optional(),
});

export const exportProcessStepSchema = z.object({
  icon: exportIconSchema,
  title: z.string().trim().min(1, "Title is required.").max(100),
  description: z.string().trim().min(1, "Description is required.").max(300),
  visible: z.boolean().default(true),
});

export const updateExportProcessStepSchema = z.object({
  icon: exportIconSchema.optional(),
  title: z.string().trim().min(1, "Title is required.").max(100).optional(),
  description: z.string().trim().min(1, "Description is required.").max(300).optional(),
  visible: z.boolean().optional(),
});

export const exportContentReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});
