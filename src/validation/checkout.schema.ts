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

/** Export fulfilment flow. Pickup replaces the normal address/delivery-zone flow entirely; Deliver keeps it, with these fields layered on top. */
export const fulfilmentMethodSchema = z.enum(["Delivery", "Pickup"]);

/** Export fulfilment flow. Collected via a new checkout step shown only for a cart with an export-declared packaging line. */
export const travelerDetailsSchema = z.object({
  travelerName: trimmedRequired("Name", 120),
  travelerCountry: trimmedRequired("Country you're visiting", 100),
  travelerPhone: trimmedRequired("Local contact number", 32).regex(/^[+\d][\d\s-]{6,}$/, "Enter a valid phone number"),
});

export type TravelerDetailsInput = z.infer<typeof travelerDetailsSchema>;

/** New Step 1 (export carts only): fulfilment fork + traveler details. */
export const checkoutExportDetailsStepSchema = z.object({
  fulfilmentMethod: fulfilmentMethodSchema,
  traveler: travelerDetailsSchema,
});

export type CheckoutExportDetailsStepInput = z.infer<typeof checkoutExportDetailsStepSchema>;

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

/** Story 4 (Payment Restriction). Mirrors the Prisma PaymentMethod enum's exact values. */
export const paymentMethodSchema = z.enum(["Card", "BankTransfer", "CashOnDelivery"]);

/** Step 3 payload: intent creation — amount is always computed server-side. City is required only for Delivery; Pickup has no delivery charge to resolve. */
export const checkoutPaymentIntentSchema = z
  .object({
    city: trimmedOptional(100),
    paymentMethod: paymentMethodSchema,
    fulfilmentMethod: fulfilmentMethodSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.fulfilmentMethod ?? "Delivery") === "Delivery" && !data.city) {
      ctx.addIssue({ code: "custom", path: ["city"], message: "City is required" });
    }
  });

export type CheckoutPaymentIntentInput = z.infer<typeof checkoutPaymentIntentSchema>;

export const placeOrderSchema = z
  .object({
    idempotencyKey: z.uuid("Invalid idempotency key"),
    /** Export fulfilment flow. Omitted by every pre-existing caller — defaults to "Delivery" in checkout.service.ts, matching every historical order. */
    fulfilmentMethod: fulfilmentMethodSchema.optional(),
    address: checkoutAddressSchema.optional(),
    traveler: travelerDetailsSchema.optional(),
    guestEmail: z.email("Enter a valid email address").optional(),
    providerReference: trimmedRequired("Payment reference", 128),
    paymentMethod: paymentMethodSchema,
    save: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.fulfilmentMethod ?? "Delivery") === "Delivery" && !data.address) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "Address is required for delivery" });
    }
  });

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
