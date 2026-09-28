import { z } from "zod";

/**
 * Payment payloads (STORY-026 thin slice, sync mock path only). The full
 * webhook payload schema lands with STORY-026.
 */

export const confirmPaymentSchema = z.object({
  providerReference: z.string().trim().min(1, "Payment reference is required").max(128),
  /** Mock-provider outcome selector — a real gateway confirms on its own side. */
  outcome: z.enum(["success", "decline", "timeout"]),
});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;
