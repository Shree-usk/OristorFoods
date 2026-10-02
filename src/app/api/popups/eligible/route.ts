import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { validationErrorResponse } from "@/lib/api/responses";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { resolveEligiblePopup } from "@/services/popup.service";
import { popupPageTargetQuerySchema } from "@/validation/popup.schema";

/** STORY-050a. The client resolves its own trigger timing (delay/scroll/exit-intent/etc.) — this route only decides WHICH popup (if any) is eligible to show at all, given page + audience + schedule + status + authenticated-frequency-cap state. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = popupPageTargetQuerySchema.safeParse(searchParams.get("page"));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const customerGroup = await resolveCustomerGroupForUser(userId);

  const popup = await resolveEligiblePopup({ pageTarget: parsed.data, userId, customerGroup });
  return NextResponse.json({ popup });
}
