import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;

/** STORY-031. Minimal registration — no email verification, no profile fields beyond name. */
export const registerSchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
