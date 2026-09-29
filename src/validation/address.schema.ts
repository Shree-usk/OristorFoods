import { z } from "zod";

const trimmedRequired = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);
const trimmedOptional = (max: number) => z.string().trim().max(max).optional();

export const addressLabelSchema = z.enum(["Home", "Work", "Other"]);
export const addressTypeSchema = z.enum(["Shipping", "Billing", "Both"]);

const addressBaseSchema = z.object({
  label: addressLabelSchema,
  type: addressTypeSchema,
  recipientName: trimmedRequired("Recipient name", 120),
  phone: trimmedRequired("Phone number", 32).regex(/^[+\d][\d\s-]{6,}$/, "Enter a valid phone number"),
  line1: trimmedRequired("Address line 1", 200),
  line2: trimmedOptional(200),
  city: trimmedRequired("City", 100),
  // Sri Lanka's district / everywhere else's state-or-province — see the Address model's doc comment.
  district: trimmedOptional(100),
  postalCode: trimmedOptional(20),
  country: z
    .string()
    .trim()
    .length(2, "Select a country")
    .transform((value) => value.toUpperCase()),
  // Distributor persona fields — never required, since most addresses aren't a business.
  companyName: trimmedOptional(200),
  taxId: trimmedOptional(50),
});

/**
 * STORY-034. Country-conditional (AC): Sri Lanka needs a district, not a
 * postal code (LK addresses are commonly given without one); every other
 * country needs a postal code instead. Only enforced on create — a
 * partial update (addressUpdateSchema below) may legitimately touch just
 * one field, e.g. renaming the label, without the full address present to
 * cross-validate.
 */
export const addressSchema = addressBaseSchema
  .extend({
    setAsDefaultBilling: z.boolean().optional(),
    setAsDefaultShipping: z.boolean().optional(),
  })
  .refine((data) => data.country === "LK" || Boolean(data.postalCode), {
    message: "Postal code is required for international addresses.",
    path: ["postalCode"],
  })
  .refine((data) => data.country !== "LK" || Boolean(data.district), {
    message: "District is required for Sri Lankan addresses.",
    path: ["district"],
  });

export type AddressInput = z.infer<typeof addressSchema>;

export const addressUpdateSchema = addressBaseSchema.partial().extend({
  setAsDefaultBilling: z.boolean().optional(),
  setAsDefaultShipping: z.boolean().optional(),
});

export type AddressUpdateInput = z.infer<typeof addressUpdateSchema>;
