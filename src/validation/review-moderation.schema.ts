import { z } from "zod";

export const moderationSourceTypeSchema = z.enum(["product", "recipe", "blog-comment"]);

export const listModerationQueueQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sourceType: moderationSourceTypeSchema.optional(),
  status: z.string().trim().min(1).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  search: z.string().trim().min(1).optional(),
});

export const replySchema = z.object({
  body: z.string().trim().min(1, "A reply can't be empty.").max(2000),
});

export const featureSchema = z.object({
  featured: z.boolean(),
});

export const rewardCustomerSchema = z.object({
  points: z.number().int().positive().max(10_000),
  note: z.string().trim().min(1, "A note is required so the reason for this grant is recorded."),
});

export const bulkModerationSchema = z.object({
  items: z
    .array(z.object({ sourceType: moderationSourceTypeSchema, id: z.string().trim().min(1) }))
    .min(1, "Select at least one item."),
  action: z.enum(["approve", "reject"]),
});
