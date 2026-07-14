import { z } from "zod";

/** Shared between the footer's client form and the API route it posts to. */
export const newsletterSubscribeSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;
