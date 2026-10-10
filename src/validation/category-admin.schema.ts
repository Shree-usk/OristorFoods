import { z } from "zod";

import { optionalMediaUrlSchema } from "@/validation/media-url.schema";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const statusEnum = z.enum(["Active", "Inactive"]);

/** Create and update share one shape, matching product-admin.schema.ts's own convention. */
export const categoryAdminSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  slug: z.string().trim().min(1, "Slug is required.").regex(slugRegex, "Slug must be lowercase, alphanumeric, and hyphen-separated."),
  description: z.string().trim().max(2000).optional().nullable(),
  image: optionalMediaUrlSchema,
  sortOrder: z.number().int().min(0).optional(),
  status: statusEnum.optional(),
  parentId: z.string().trim().min(1).optional().nullable(),
  metaTitle: z.string().trim().max(200).optional().nullable(),
  metaDescription: z.string().trim().max(500).optional().nullable(),
  canonicalUrl: z.string().trim().url("Enter a valid URL.").optional().nullable().or(z.literal("")),
  ogImage: optionalMediaUrlSchema,
});

export type CategoryAdminFormInput = z.infer<typeof categoryAdminSchema>;
