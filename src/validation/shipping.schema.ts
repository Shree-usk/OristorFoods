import { z } from "zod";

/**
 * Shipping/delivery-zone shapes (STORY-027 thin slice).
 */

/**
 * DeliveryRate.tiers shape — validated at read time by the shipping
 * service; a rate row whose JSON fails this parse is a config_error
 * (fail-safe), never a silent 0 charge. `upTo` is grams for WeightBased
 * zones and a subtotal for ValueBased zones; tiers must ascend.
 */
export const deliveryRateTiersSchema = z
  .array(
    z.object({
      upTo: z.number().positive(),
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "amount must be a decimal string"),
    }),
  )
  .min(1)
  .refine((tiers) => tiers.every((tier, i) => i === 0 || tier.upTo > tiers[i - 1].upTo), {
    message: "tiers must be ascending by upTo",
  });

export type DeliveryRateTiers = z.infer<typeof deliveryRateTiersSchema>;
