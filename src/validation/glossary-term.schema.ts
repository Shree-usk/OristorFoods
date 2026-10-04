import { z } from "zod";

/** STORY-061. Admin CRUD for SearchGlossaryTerm. */

export const glossaryTermSchema = z.object({
  term: z.string().trim().min(1, "Term is required.").max(100),
  canonicalTerm: z.string().trim().min(1, "Canonical term is required.").max(100),
  targetType: z.string().trim().min(1).max(50).nullable().optional(),
  targetId: z.string().trim().min(1).max(100).nullable().optional(),
});

export const updateGlossaryTermSchema = glossaryTermSchema.partial();

export type GlossaryTermFormInput = z.infer<typeof glossaryTermSchema>;
export type UpdateGlossaryTermFormInput = z.infer<typeof updateGlossaryTermSchema>;
