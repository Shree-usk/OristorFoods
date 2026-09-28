import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { saveAddress } from "@/services/checkout.service";
import { checkoutAddressStepSchema } from "@/validation/checkout.schema";

/**
 * Step 1: server-side validation of the delivery address (the same Zod
 * schema RHF enforces client-side). Authenticated callers may pass
 * `save: true` to persist it; guests get validation only — their address
 * is never stored outside the order snapshot.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = checkoutAddressStepSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    if (!userId && !parsed.data.guestEmail) {
      return NextResponse.json(
        { error: "An email address is required to continue as a guest.", code: "guest_email_required" },
        { status: 400 },
      );
    }

    if (userId && parsed.data.save) {
      const saved = await saveAddress(userId, parsed.data.address);
      return NextResponse.json({ ok: true, savedAddressId: saved.id });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
