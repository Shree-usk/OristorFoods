import { z } from "zod";

/** Support ticket payloads (STORY-036). */

const trimmedRequired = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const supportTicketCategorySchema = z.enum(["OrderIssue", "Product", "Delivery", "Billing", "Other"]);

export const supportTicketSchema = z.object({
  category: supportTicketCategorySchema,
  subject: trimmedRequired("Subject", 200),
  message: trimmedRequired("Message", 4000),
  orderNumber: z.string().trim().min(1).optional(),
});

export type SupportTicketInput = z.infer<typeof supportTicketSchema>;

export const listSupportTicketsQuerySchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(50).catch(20),
});

export type ListSupportTicketsQuery = z.infer<typeof listSupportTicketsQuerySchema>;
