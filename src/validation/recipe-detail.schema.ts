import { z } from "zod";

export const recipeSlugParamSchema = z.object({
  slug: z.string().min(1),
});
