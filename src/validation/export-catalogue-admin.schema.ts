import { z } from "zod";

export const exportCatalogueAdminListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: z.enum(["Draft", "Published", "Archived", "Discontinued", "OutOfSeason", "Review"]).optional(),
  page: z.coerce.number().int().positive().optional(),
});

export const bulkSetExportVisibilitySchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one product."),
  isExportEnabled: z.boolean(),
});

// `showPricing` is stored and round-trips through the admin settings panel,
// but is deliberately NOT read anywhere in the public catalogue listing
// (export-catalogue.service.ts::listExportCatalogueProducts) or the PDF
// (export-catalogue-pdf.service.tsx) — deferred during the staging
// acceptance review rather than invented: the public catalogue route is
// unauthenticated, so wiring this up would publish a price to every
// anonymous visitor with no way to scope it to a buyer type, which is a
// business pricing-strategy decision, not an engineering default. The
// admin UI disables the checkbox and explains this; do not wire it up
// without that business decision being made explicitly first.
export const exportCatalogueSettingSchema = z.object({
  title: z.string().trim().max(200).optional().nullable(),
  introText: z.string().trim().max(2000).optional().nullable(),
  showPricing: z.boolean().optional(),
});
export type ExportCatalogueSettingInput = z.infer<typeof exportCatalogueSettingSchema>;
