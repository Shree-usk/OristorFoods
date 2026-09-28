import { z } from "zod";

/** Payment payloads (STORY-026). */

export const confirmPaymentSchema = z.object({
  providerReference: z.string().trim().min(1, "Payment reference is required").max(128),
  /** Mock-provider outcome selector — a real gateway confirms on its own side. */
  outcome: z.enum(["success", "decline", "timeout"]),
});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;

/**
 * Shape of the mock provider's webhook body, validated only AFTER its
 * signature has been verified (see mock-payment.provider.ts) — never
 * trust webhook content ahead of the signature check. A real gateway's
 * webhook envelope looks nothing like this; that provider would define
 * and validate its own shape behind the same PaymentProvider.handleWebhook
 * contract.
 */
export const mockWebhookPayloadSchema = z.object({
  providerReference: z.string().trim().min(1).max(128),
  outcome: z.enum(["success", "decline"]),
});

export type MockWebhookPayload = z.infer<typeof mockWebhookPayloadSchema>;
