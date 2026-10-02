import { z } from "zod";

const pathSchema = z.string().trim().min(1).regex(/^\//, 'Must start with "/"');

export const redirectSchema = z.object({
  sourcePath: pathSchema,
  destinationPath: pathSchema,
  statusCode: z.union([z.literal(301), z.literal(302)]),
  active: z.boolean().optional().default(true),
});

export const redirectUpdateSchema = z.object({
  sourcePath: pathSchema.optional(),
  destinationPath: pathSchema.optional(),
  statusCode: z.union([z.literal(301), z.literal(302)]).optional(),
  active: z.boolean().optional(),
});

export const bulkImportRedirectsSchema = z.object({
  csv: z.string().trim().min(1, "The CSV file is empty."),
});
