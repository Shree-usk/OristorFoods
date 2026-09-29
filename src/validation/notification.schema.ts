import { z } from "zod";

/** Notification channel preferences update (STORY-032, extended by STORY-034). */

export const updatePreferencesSchema = z.object({
  phone: z.string().trim().max(20).optional(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  whatsappOptIn: z.boolean().optional(),
  rewardUpdatesOptIn: z.boolean().optional(),
  // STORY-034's "promotional emails" toggle — actually User.marketingOptIn
  // (set at registration), not a NotificationPreference field. Accepted
  // here so the one settings form can PATCH both in a single request; the
  // route handler splits it out. See docs/architecture-decisions.md.
  marketingOptIn: z.boolean().optional(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
