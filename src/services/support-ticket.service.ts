import type { SupportTicketCategory, SupportTicketStatus } from "@/generated/prisma/client";
import * as supportTicketRepository from "@/repositories/support-ticket.repository";
import { getOrderForConfirmation } from "@/services/order.service";

/**
 * STORY-036. First-party — no underlying story's engine to wrap (unlike
 * customer-order-history.service.ts). The optional order reference is
 * ownership-checked through order.service.ts's existing
 * getOrderForConfirmation before being attached, so a ticket can never
 * reference another customer's order.
 */

export interface TicketSummary {
  id: string;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  orderNumber: string | null;
  createdAt: string;
}

export interface CreateTicketInput {
  category: SupportTicketCategory;
  subject: string;
  message: string;
  orderNumber?: string;
  /** STORY-063. Optional — the Recipe/Support Assistant escalation path only. */
  source?: "AiAssistant";
  conversationId?: string;
}

function toSummary(ticket: { id: string; category: SupportTicketCategory; subject: string; message: string; status: SupportTicketStatus; createdAt: Date }, orderNumber: string | null): TicketSummary {
  return {
    id: ticket.id,
    category: ticket.category,
    subject: ticket.subject,
    message: ticket.message,
    status: ticket.status,
    orderNumber,
    createdAt: ticket.createdAt.toISOString(),
  };
}

export async function createTicket(userId: string, input: CreateTicketInput): Promise<TicketSummary> {
  let orderId: string | null = null;
  if (input.orderNumber) {
    const order = await getOrderForConfirmation(input.orderNumber, userId, null);
    orderId = order.id;
  }

  const ticket = await supportTicketRepository.createSupportTicket({
    userId,
    orderId,
    category: input.category,
    subject: input.subject,
    message: input.message,
    source: input.source,
    conversationId: input.conversationId,
  });

  return toSummary(ticket, input.orderNumber ?? null);
}

export interface TicketHistoryPage {
  tickets: TicketSummary[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * orderNumber isn't stored on the ticket row (only orderId) — this list
 * view shows category/subject/status only, matching the AC's "ticket
 * history list ... with status"; the order-detail page's own "Contact
 * Support" pre-fill flow already knows the orderNumber it launched from.
 */
export async function listTicketsForUser(userId: string, page: number, pageSize: number): Promise<TicketHistoryPage> {
  const { tickets, total } = await supportTicketRepository.findSupportTicketsByUserId(userId, page, pageSize);
  return { tickets: tickets.map((ticket) => toSummary(ticket, null)), total, page, pageSize };
}
