import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createReturnRequest } from "@/services/customer-order-history.service";
import { returnRequestSchema } from "@/validation/return-request.schema";

/** STORY-036. Session-only. Only a Delivered order can have a return requested (enforced in the service). */
export async function POST(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = returnRequestSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const returnRequest = await createReturnRequest(userId, orderNumber, parsed.data);
    return NextResponse.json({ id: returnRequest.id, status: returnRequest.status });
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
