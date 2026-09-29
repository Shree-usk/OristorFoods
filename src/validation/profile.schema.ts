import { z } from "zod";

/** STORY-034. Empty string is treated the same as "not provided" (cleared) — forms send "" rather than omit the field. */
const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""));

export const updateProfileSchema = z.object({
  name: optionalTrimmed(200),
  phone: optionalTrimmed(32),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date")
    .optional()
    .or(z.literal("")),
  image: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .optional()
    .or(z.literal("")),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Changing email requires re-verification before it takes effect (AC) — a separate action from the rest of the profile form. */
export const changeEmailSchema = z.object({
  email: z.email(),
});

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export const confirmEmailChangeSchema = z.object({
  userId: z.string().min(1),
  token: z.string().min(1),
});

export type ConfirmEmailChangeInput = z.infer<typeof confirmEmailChangeSchema>;

export const deactivateAccountSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type DeactivateAccountInput = z.infer<typeof deactivateAccountSchema>;
