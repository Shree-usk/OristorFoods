import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createTicket, listTicketsForUser } from "@/services/support-ticket.service";
import { listSupportTicketsQuerySchema, supportTicketSchema } from "@/validation/support-ticket.schema";

/** STORY-036. Session-only — support tickets are an account feature. */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = listSupportTicketsQuerySchema.parse(Object.fromEntries(searchParams));

  const result = await listTicketsForUser(userId, page, pageSize);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = supportTicketSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const ticket = await createTicket(userId, parsed.data);
    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
