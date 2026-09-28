import { z } from "zod";

/** Coupon-code submission (STORY-029). */

export const applyCouponSchema = z.object({
  code: z
    .string({ error: "Coupon code is required" })
    .trim()
    .toUpperCase()
    .min(3, "Coupon code must be at least 3 characters")
    .max(32, "Coupon code must be 32 characters or fewer")
    .regex(/^[A-Z0-9-]+$/, "Coupon code can only contain letters, numbers, and hyphens"),
});

export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;
