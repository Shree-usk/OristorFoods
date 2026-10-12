import { z } from "zod";

import { optionalMediaUrlSchema } from "@/validation/media-url.schema";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const statusEnum = z.enum(["Active", "Inactive"]);

/** Create and update share one shape, matching category-admin.schema.ts's own convention. */
export const collectionAdminSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  slug: z.string().trim().min(1, "Slug is required.").regex(slugRegex, "Slug must be lowercase, alphanumeric, and hyphen-separated."),
  description: z.string().trim().max(2000).optional().nullable(),
  image: optionalMediaUrlSchema,
  status: statusEnum.optional(),
  // Plain strings, not z.coerce.date() — a date <input> sends "" for a
  // cleared field, which z.coerce.date() would reject as Invalid Date
  // rather than treat as "no date." Parsed in collection.service.ts
  // alongside the other nullIfBlank-style optional fields instead.
  startDate: z.string().trim().optional().nullable().or(z.literal("")),
  endDate: z.string().trim().optional().nullable().or(z.literal("")),
  metaTitle: z.string().trim().max(200).optional().nullable(),
  metaDescription: z.string().trim().max(500).optional().nullable(),
  canonicalUrl: z.string().trim().url("Enter a valid URL.").optional().nullable().or(z.literal("")),
  ogImage: optionalMediaUrlSchema,
  productIds: z.array(z.string()).optional(),
});

export type CollectionAdminFormInput = z.infer<typeof collectionAdminSchema>;
