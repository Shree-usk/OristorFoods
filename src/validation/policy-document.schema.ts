import { z } from "zod";

/** STORY-063. Admin CRUD for PolicyDocument. */

export const policyDocumentSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only."),
  title: z.string().trim().min(1, "Title is required.").max(150),
  content: z.string().trim().min(1, "Content is required.").max(20_000),
});

export const updatePolicyDocumentSchema = policyDocumentSchema.partial();

export type PolicyDocumentFormInput = z.infer<typeof policyDocumentSchema>;
export type UpdatePolicyDocumentFormInput = z.infer<typeof updatePolicyDocumentSchema>;
