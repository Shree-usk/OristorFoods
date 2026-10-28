import { z } from "zod";

/** Story 5 (Free Gift). Validation for the admin GiftOffer CRUD endpoints — mirrors coupon-admin.schema.ts's create/update split and bundleAdminSchema's date/optional-numeric field conventions. */

const optionalCoercedDate = z.preprocess((value) => (value === "" ? undefined : value), z.coerce.date().optional().nullable());

const giftOfferFields = {
  name: z.string().trim().min(1, "Name is required.").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["Active", "Inactive"]).optional(),
  startDate: optionalCoercedDate,
  endDate: optionalCoercedDate,
  minQuantity: z.number().int().positive().optional().nullable(),
  minSpend: z.number().nonnegative().optional().nullable(),
  giftProductId: z.string().min(1, "Select a gift product."),
  giftVariantId: z.string().min(1).optional().nullable(),
  giftQuantity: z.number().int().positive().optional(),
  giftStockLimit: z.number().int().positive().optional().nullable(),
  redemptionLimitGlobal: z.number().int().positive().optional().nullable(),
  redemptionLimitPerCustomer: z.number().int().positive().optional().nullable(),
  stackable: z.boolean().optional(),
};

function refineDates<T extends { startDate?: Date | null; endDate?: Date | null }>(schema: z.ZodType<T>) {
  return schema.refine((data) => !data.startDate || !data.endDate || data.endDate > data.startDate, {
    message: "End date must be after the start date.",
    path: ["endDate"],
  });
}

/** productId (the qualifying product) and qualifyingVariantId are required/immutable — set once at creation, same as every other identity-defining FK in this codebase. qualifyingVariantId is deliberately NOT in giftOfferFields, so updateGiftOfferSchema structurally cannot accept it. */
export const createGiftOfferSchema = refineDates(
  z.object({
    productId: z.string().min(1, "Select a qualifying product."),
    qualifyingVariantId: z.string().min(1).optional().nullable(),
    ...giftOfferFields,
  }),
);

export type CreateGiftOfferFormInput = z.infer<typeof createGiftOfferSchema>;

export const updateGiftOfferSchema = refineDates(z.object(giftOfferFields).partial());

export type UpdateGiftOfferFormInput = z.infer<typeof updateGiftOfferSchema>;
