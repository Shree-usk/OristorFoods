import { z } from "zod";

export const foodAcademyListQuerySchema = z.object({
  category: z.string().trim().min(1).optional().catch(undefined),
  contentType: z.enum(["Article", "Guide", "Course"]).optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(48).catch(12),
});
export type FoodAcademyListQuery = z.infer<typeof foodAcademyListQuerySchema>;

export const foodAcademySlugParamSchema = z.object({
  slug: z.string().min(1),
});
