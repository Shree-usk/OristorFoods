import { z } from "zod";

export const submitExportEnquirySchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required.").max(200),
  contactName: z.string().trim().min(1, "Contact name is required.").max(150),
  contactEmail: z.string().trim().email("Enter a valid email."),
  contactPhone: z.string().trim().max(30).optional(),
  country: z.string().trim().min(1, "Country is required.").max(100),
  productsOfInterest: z.string().trim().min(1, "Let us know which products you're interested in.").max(500),
  volumeEstimate: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1, "Message is required.").max(4000),
});
export type SubmitExportEnquiryInput = z.infer<typeof submitExportEnquirySchema>;

export const updateEnquiryStatusSchema = z.object({
  status: z.enum(["New", "InDiscussion", "Quoted", "Won", "Lost"]),
});

export const assignEnquirySchema = z.object({
  assignedToId: z.string().trim().min(1).nullable(),
});

export const addEnquiryNoteSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty.").max(2000),
});

export const replyToEnquirySchema = z.object({
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  body: z.string().trim().min(1, "Message is required.").max(4000),
});

export const convertEnquirySchema = z.object({
  region: z.string().trim().min(1, "Region is required.").max(100),
});

export const exportEnquiryFiltersSchema = z.object({
  status: z.enum(["New", "InDiscussion", "Quoted", "Won", "Lost"]).optional(),
  country: z.string().trim().min(1).optional(),
  companyName: z.string().trim().min(1).optional(),
  productsOfInterest: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional(),
});
