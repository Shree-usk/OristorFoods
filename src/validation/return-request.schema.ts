import { z } from "zod";

/** Return request payloads (STORY-036). */

const trimmedRequired = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const returnRequestSchema = z.object({
  reason: trimmedRequired("Reason", 1000),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        quantity: z.number().int().positive("Quantity must be at least 1."),
      }),
    )
    .min(1, "Select at least one item to return."),
});

export type ReturnRequestInput = z.infer<typeof returnRequestSchema>;
