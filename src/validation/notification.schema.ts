import { z } from "zod";

/** Notification channel preferences update (STORY-032). */

export const updatePreferencesSchema = z.object({
  phone: z.string().trim().max(20).optional(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  whatsappOptIn: z.boolean().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
