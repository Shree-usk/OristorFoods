import { z } from "zod";

/**
 * Reference pattern for feature teams: define the Zod schema once, infer
 * the TypeScript type from it, and reuse the same schema for both
 * React Hook Form (client) and route-handler input validation (server).
 */
export const newsletterSignupSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export type NewsletterSignupInput = z.infer<typeof newsletterSignupSchema>;
