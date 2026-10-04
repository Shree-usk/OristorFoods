import { z } from "zod";

/** STORY-060. Validation for /api/recommendations/*. */

export const cartRecommendationsSchema = z.object({
  productIds: z.array(z.string().trim().min(1)).min(1).max(50),
});

export type CartRecommendationsInput = z.infer<typeof cartRecommendationsSchema>;

export const trackRecommendationSchema = z.object({
  placement: z.enum(["Homepage", "Pdp", "Cart"]),
  productId: z.string().trim().min(1),
  action: z.enum(["Impression", "Click", "AddToCart"]),
});

export type TrackRecommendationInput = z.infer<typeof trackRecommendationSchema>;
