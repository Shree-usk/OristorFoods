import { z } from "zod";

/** STORY-050b. Validation for the admin Coupon/Promotion CRUD endpoints — discount.service.ts's existing read side is untouched by this story. */

const couponDiscountTypeEnum = z.enum(["PercentageOff", "FixedAmountOff", "FreeShipping"]);
const couponScopeEnum = z.enum(["AllProducts", "Category", "Product"]);

const discountFields = {
  discountType: couponDiscountTypeEnum,
  percentOff: z.number().min(0).max(100).nullable().optional(),
  amountOff: z.number().positive().nullable().optional(),
};

const scopeFields = {
  scope: couponScopeEnum,
  scopeProductIds: z.array(z.string().trim().min(1)).optional(),
  scopeCategoryIds: z.array(z.string().trim().min(1)).optional(),
};

function refineDiscountAndScope<T extends { discountType: string; percentOff?: number | null; amountOff?: number | null; scope: string; scopeProductIds?: string[]; scopeCategoryIds?: string[] }>(
  schema: z.ZodType<T>,
) {
  return schema
    .refine((data) => data.discountType !== "PercentageOff" || (data.percentOff !== undefined && data.percentOff !== null), {
      message: "A percentage is required for a percentage-off discount.",
      path: ["percentOff"],
    })
    .refine((data) => data.discountType !== "FixedAmountOff" || (data.amountOff !== undefined && data.amountOff !== null), {
      message: "An amount is required for a fixed-amount discount.",
      path: ["amountOff"],
    })
    .refine((data) => data.scope !== "Product" || (data.scopeProductIds && data.scopeProductIds.length > 0), {
      message: "Select at least one product.",
      path: ["scopeProductIds"],
    })
    .refine((data) => data.scope !== "Category" || (data.scopeCategoryIds && data.scopeCategoryIds.length > 0), {
      message: "Select at least one category.",
      path: ["scopeCategoryIds"],
    });
}

export const couponSchema = refineDiscountAndScope(
  z.object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphens, or underscores only."),
    ...discountFields,
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    minOrderValue: z.number().nonnegative().nullable().optional(),
    usageLimitGlobal: z.number().int().positive().nullable().optional(),
    usageLimitPerCustomer: z.number().int().positive().nullable().optional(),
    stackable: z.boolean().default(false),
    ...scopeFields,
  }).refine((data) => data.endDate > data.startDate, { message: "End date must be after the start date.", path: ["endDate"] }),
);

export const couponUpdateSchema = z.object({
  discountType: couponDiscountTypeEnum.optional(),
  percentOff: z.number().min(0).max(100).nullable().optional(),
  amountOff: z.number().positive().nullable().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  minOrderValue: z.number().nonnegative().nullable().optional(),
  usageLimitGlobal: z.number().int().positive().nullable().optional(),
  usageLimitPerCustomer: z.number().int().positive().nullable().optional(),
  scope: couponScopeEnum.optional(),
  stackable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  scopeProductIds: z.array(z.string().trim().min(1)).optional(),
  scopeCategoryIds: z.array(z.string().trim().min(1)).optional(),
});

export const promotionSchema = refineDiscountAndScope(
  z.object({
    name: z.string().trim().min(1),
    displayLabel: z.string().trim().min(1),
    ...discountFields,
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    minOrderValue: z.number().nonnegative().nullable().optional(),
    stackable: z.boolean().default(false),
    priority: z.number().int().default(0),
    ...scopeFields,
  }).refine((data) => data.endDate > data.startDate, { message: "End date must be after the start date.", path: ["endDate"] }),
);

export const promotionUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  displayLabel: z.string().trim().min(1).optional(),
  discountType: couponDiscountTypeEnum.optional(),
  percentOff: z.number().min(0).max(100).nullable().optional(),
  amountOff: z.number().positive().nullable().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  minOrderValue: z.number().nonnegative().nullable().optional(),
  scope: couponScopeEnum.optional(),
  stackable: z.boolean().optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
  scopeProductIds: z.array(z.string().trim().min(1)).optional(),
  scopeCategoryIds: z.array(z.string().trim().min(1)).optional(),
});
