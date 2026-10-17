import { z } from "zod";

export const exportCatalogueProductsQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  collectionSlug: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(48).optional(),
});

export const exportCataloguePdfRequestSchema = z.object({
  productIds: z.array(z.string().trim().min(1)).min(1, "Select at least one product.").max(50),
});
