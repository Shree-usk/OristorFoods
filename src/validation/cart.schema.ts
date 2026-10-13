import { z } from "zod";

const packagingDeclaredAvailabilityEnum = z.enum(["Local", "Export"]);

export const addCartItemSchema = z
  .object({
    productId: z.string().min(1),
    quantity: z.number({ error: "Quantity is required" }).int().positive(),
    variantId: z.string().min(1).optional(),
    packagingOptionId: z.string().min(1).optional(),
    packagingDeclaredAvailability: packagingDeclaredAvailabilityEnum.optional(),
  })
  .refine((data) => (data.packagingOptionId != null) === (data.packagingDeclaredAvailability != null), {
    message: "packagingOptionId and packagingDeclaredAvailability must be given together",
    path: ["packagingOptionId"],
  });

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number({ error: "Quantity is required" }).int().positive(),
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

// --- Bundles (Story 2) ---

const bundleSelectionSchema = z.object({
  bundleItemId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const addBundleToCartSchema = z.object({
  bundleId: z.string().min(1),
  selections: z.array(bundleSelectionSchema).nullable().optional(),
});

export type AddBundleToCartInput = z.infer<typeof addBundleToCartSchema>;

export const bundlePreviewSchema = z.object({
  selections: z.array(bundleSelectionSchema).min(1, "Select at least one item."),
});
