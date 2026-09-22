import { z } from "zod";

export const compareIdsSchema = z
  .string()
  .transform((raw) => [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))])
  .pipe(z.array(z.string().min(1)).min(1).max(4));

export type CompareIdsInput = z.infer<typeof compareIdsSchema>;
