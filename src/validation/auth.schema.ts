import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;

/** STORY-033. Shared rule for any password a customer sets themselves (register, reset) — same minimum as credentialsSchema's. */
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

/** STORY-033 extends STORY-031's minimal registration with a marketing opt-in checkbox. */
export const registerSchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.email(),
  password: passwordSchema,
  marketingOptIn: z.boolean(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/** STORY-033. Always returns 200 regardless of match — see auth.service.ts's requestPasswordReset. */
export const forgotPasswordSchema = z.object({
  email: z.email(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** STORY-033. Same password rule as registration, per the story's AC. */
export const resetPasswordSchema = z.object({
  email: z.email(),
  token: z.string().min(1, "Missing reset token."),
  password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
