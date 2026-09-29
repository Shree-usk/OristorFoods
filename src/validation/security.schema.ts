import { z } from "zod";

import { passwordSchema } from "@/validation/auth.schema";

/** STORY-034. Same complexity rule as registration/reset (AC) — reuses auth.schema.ts's passwordSchema directly. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
