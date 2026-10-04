import { z } from "zod";

/**
 * STORY-072. "Export" is deliberately included in the submission-facing
 * enquiry-type list even though it is NOT a ContactEnquiryType Prisma enum
 * value — selecting it routes into the existing ExportEnquiry pipeline
 * (STORY-058) instead of ever being stored as a ContactEnquiry row. See
 * contact-enquiry.service.ts.
 */
export const CONTACT_ENQUIRY_TYPES = [
  "General",
  "Product",
  "CustomerSupport",
  "Wholesale",
  "Distributor",
  "Export",
  "RetailPartnership",
  "FoodService",
  "Media",
  "Careers",
  "Other",
] as const;
export type ContactEnquiryTypeValue = (typeof CONTACT_ENQUIRY_TYPES)[number];

/** The subset actually ever persisted as a ContactEnquiry row (excludes "Export", which routes into ExportEnquiry instead) — used for admin filtering, never for the submission-facing select. */
const STORED_CONTACT_ENQUIRY_TYPES = ["General", "Product", "CustomerSupport", "Wholesale", "Distributor", "RetailPartnership", "FoodService", "Media", "Careers", "Other"] as const;

/**
 * honeypot deliberately has no length constraint here — mirrors
 * blog.schema.ts's own reasoning exactly: a `.max(0)` would make this
 * schema's own `safeParse` reject a filled honeypot with a 400 before
 * contact-enquiry.service.ts's silent no-op ever runs, defeating "a bot
 * must not be able to tell honeypot/rate-limit/success apart."
 */
export const submitContactEnquirySchema = z.object({
  contactName: z.string().trim().min(1, "Name is required.").max(150),
  contactEmail: z.string().trim().email("Enter a valid email."),
  contactPhone: z.string().trim().max(30).optional(),
  enquiryType: z.enum(CONTACT_ENQUIRY_TYPES),
  companyName: z.string().trim().max(200).optional(),
  country: z.string().trim().max(100).optional(),
  businessType: z.string().trim().max(100).optional(),
  productInterest: z.string().trim().max(500).optional(),
  estimatedRequirement: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1, "Message is required.").max(4000),
  honeypot: z.string(),
});
export type SubmitContactEnquiryInput = z.infer<typeof submitContactEnquirySchema>;

export const updateContactEnquiryStatusSchema = z.object({
  status: z.enum(["New", "InProgress", "Responded", "Closed", "Spam"]),
});

export const contactEnquiryFiltersSchema = z.object({
  status: z.enum(["New", "InProgress", "Responded", "Closed", "Spam"]).optional(),
  enquiryType: z.enum(STORED_CONTACT_ENQUIRY_TYPES).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
});
