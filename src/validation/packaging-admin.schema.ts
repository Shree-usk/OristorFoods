import { z } from "zod";

import { optionalMediaUrlSchema } from "@/validation/media-url.schema";

/**
 * Story 3 (Custom Packaging) admin schemas.
 *
 * The admin date <input type="date"> sends "" (never omitted/null) when
 * left blank — z.coerce.date() on "" produces an Invalid Date, which Zod
 * v4 reports as a confusing "expected date, received Date" rather than a
 * validation failure. Normalize "" to undefined before coercion — the
 * exact fix already applied to bundleAdminSchema's own date fields after
 * being caught live on staging during Story 2.
 */
const optionalCoercedDate = z.preprocess((value) => (value === "" ? undefined : value), z.coerce.date().optional().nullable());

const contentStatusEnum = z.enum(["Active", "Inactive"]);

export const packagingMethodAdminSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  image: optionalMediaUrlSchema,
  status: contentStatusEnum.optional(),
});

export type PackagingMethodAdminFormInput = z.infer<typeof packagingMethodAdminSchema>;

const packagingAvailabilityEnum = z.enum(["Local", "Export", "Both"]);
const packagingOptionStatusEnum = z.enum(["Active", "TemporarilyUnavailable", "Discontinued"]);

export const productPackagingOptionAdminSchema = z
  .object({
    packagingMethodId: z.string().min(1, "Select a packaging method."),
    variantId: z.string().min(1).optional().nullable(),
    charge: z.number().nonnegative().optional(),
    minQuantity: z.number().int().positive().optional().nullable(),
    availability: packagingAvailabilityEnum.optional(),
    requiresManualReview: z.boolean().optional(),
    leadTimeDays: z.number().int().min(0).optional().nullable(),
    shelfLifeDays: z.number().int().min(0).optional().nullable(),
    shelfLifeText: z.string().trim().max(500).optional().nullable(),
    customerInstructions: z.string().trim().max(1000).optional().nullable(),
    availabilityStartDate: optionalCoercedDate,
    availabilityEndDate: optionalCoercedDate,
    orderCutoffDate: optionalCoercedDate,
    status: packagingOptionStatusEnum.optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((data) => !data.availabilityStartDate || !data.availabilityEndDate || data.availabilityEndDate > data.availabilityStartDate, {
    message: "availabilityEndDate must be after availabilityStartDate",
    path: ["availabilityEndDate"],
  });

export type ProductPackagingOptionAdminFormInput = z.infer<typeof productPackagingOptionAdminSchema>;
