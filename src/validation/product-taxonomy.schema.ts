import { z } from "zod";

import { optionalMediaUrlSchema } from "@/validation/media-url.schema";

export const allergenAdminSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  icon: optionalMediaUrlSchema,
});

export const certificationAdminSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(150),
  certificateImage: optionalMediaUrlSchema,
  documentUrl: optionalMediaUrlSchema,
});
