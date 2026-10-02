import { z } from "zod";

export const reverseFlagSchema = z.object({
  note: z.string().trim().min(1, "A note is required so the reversal is recorded."),
});

export const fraudFlagStatusEnum = z.enum(["Pending", "Approved", "Reversed"]);
