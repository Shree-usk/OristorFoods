import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getPreferenceForUser, updatePreferenceForUser } from "@/services/notification.service";
import { updatePreferencesSchema } from "@/validation/notification.schema";

/** Session-only (STORY-032) — consumed by STORY-034's future account-settings page. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const preference = await getPreferenceForUser(userId);
  return NextResponse.json({
    phone: preference?.phone ?? null,
    emailOptIn: preference?.emailOptIn ?? true,
    smsOptIn: preference?.smsOptIn ?? false,
    whatsappOptIn: preference?.whatsappOptIn ?? false,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const body: unknown = await request.json();
  const parsed = updatePreferencesSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const preference = await updatePreferenceForUser(userId, parsed.data);
  return NextResponse.json({
    phone: preference.phone,
    emailOptIn: preference.emailOptIn,
    smsOptIn: preference.smsOptIn,
    whatsappOptIn: preference.whatsappOptIn,
  });
}
