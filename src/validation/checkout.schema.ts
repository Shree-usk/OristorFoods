import { z } from "zod";

/**
 * Checkout step schemas (STORY-025) — each enforced client-side (RHF
 * resolver) AND server-side (API route) before the customer can advance.
 */

const trimmedRequired = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

const trimmedOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? undefined : value))
    .optional();

export const checkoutAddressSchema = z.object({
  recipientName: trimmedRequired("Recipient name", 120),
  phone: trimmedRequired("Phone number", 32).regex(/^[+\d][\d\s-]{6,}$/, "Enter a valid phone number"),
  line1: trimmedRequired("Address line 1", 200),
  line2: trimmedOptional(200),
  city: trimmedRequired("City", 100),
  district: trimmedOptional(100),
  postalCode: trimmedOptional(20),
});

export type CheckoutAddressInput = z.infer<typeof checkoutAddressSchema>;

/** Step 1 payload: an inline address (guests must also supply an email). */
export const checkoutAddressStepSchema = z.object({
  address: checkoutAddressSchema,
  guestEmail: z.email("Enter a valid email address").optional(),
  /** Authenticated callers only — persist this address for reuse. */
  save: z.boolean().optional(),
});

export type CheckoutAddressStepInput = z.infer<typeof checkoutAddressStepSchema>;

/** Step 2 payload: only the city matters for zone resolution. */
export const checkoutDeliverySchema = z.object({
  city: trimmedRequired("City", 100),
});

export type CheckoutDeliveryInput = z.infer<typeof checkoutDeliverySchema>;

/** Step 3 payload: intent creation — amount is always computed server-side. */
export const checkoutPaymentIntentSchema = z.object({
  city: trimmedRequired("City", 100),
});

export type CheckoutPaymentIntentInput = z.infer<typeof checkoutPaymentIntentSchema>;

export const placeOrderSchema = z.object({
  idempotencyKey: z.uuid("Invalid idempotency key"),
  address: checkoutAddressSchema,
  guestEmail: z.email("Enter a valid email address").optional(),
  providerReference: trimmedRequired("Payment reference", 128),
  save: z.boolean().optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
