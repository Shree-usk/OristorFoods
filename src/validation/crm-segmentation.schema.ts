import { z } from "zod";

const CUSTOMER_GROUPS = ["Retail", "Wholesale", "Distributor", "Export", "PrivateLabel"] as const;

export const segmentFilterCriteriaSchema = z.object({
  minOrderCount: z.coerce.number().int().nonnegative().optional(),
  maxOrderCount: z.coerce.number().int().nonnegative().optional(),
  minLifetimeValue: z.coerce.number().nonnegative().optional(),
  maxLifetimeValue: z.coerce.number().nonnegative().optional(),
  city: z.string().trim().min(1).optional(),
  rewardTierId: z.string().trim().min(1).optional(),
  customerGroup: z.enum(CUSTOMER_GROUPS).optional(),
  lastOrderAfter: z.coerce.date().optional(),
  lastOrderBefore: z.coerce.date().optional(),
});

export const createSegmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(150),
  filterCriteria: segmentFilterCriteriaSchema,
});

export const updateSegmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(150).optional(),
  filterCriteria: segmentFilterCriteriaSchema.optional(),
});

export type SegmentFilterCriteria = z.infer<typeof segmentFilterCriteriaSchema>;
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;
export type UpdateSegmentInput = z.infer<typeof updateSegmentSchema>;
