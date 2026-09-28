import { z } from "zod";

export const addCartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number({ error: "Quantity is required" }).int().positive(),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number({ error: "Quantity is required" }).int().positive(),
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
