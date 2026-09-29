import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getPreferenceForUser, updatePreferenceForUser } from "@/services/notification.service";
import { getProfile, updateProfile } from "@/services/profile.service";
import { updatePreferencesSchema } from "@/validation/notification.schema";

/** Session-only (STORY-032, extended by STORY-034's account/notifications page). */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const [preference, user] = await Promise.all([getPreferenceForUser(userId), getProfile(userId)]);
  return NextResponse.json({
    phone: preference?.phone ?? null,
    emailOptIn: preference?.emailOptIn ?? true,
    smsOptIn: preference?.smsOptIn ?? false,
    whatsappOptIn: preference?.whatsappOptIn ?? false,
    rewardUpdatesOptIn: preference?.rewardUpdatesOptIn ?? true,
    // STORY-034: "promotional emails" is User.marketingOptIn, not a NotificationPreference field — see notification.schema.ts.
    marketingOptIn: user?.marketingOptIn ?? false,
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const body: unknown = await request.json();
  const parsed = updatePreferencesSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { marketingOptIn, ...preferenceInput } = parsed.data;
  const [preference, user] = await Promise.all([
    updatePreferenceForUser(userId, preferenceInput),
    marketingOptIn === undefined ? getProfile(userId) : updateProfile(userId, { marketingOptIn }),
  ]);

  return NextResponse.json({
    phone: preference.phone,
    emailOptIn: preference.emailOptIn,
    smsOptIn: preference.smsOptIn,
    whatsappOptIn: preference.whatsappOptIn,
    rewardUpdatesOptIn: preference.rewardUpdatesOptIn,
    marketingOptIn: user?.marketingOptIn ?? false,
  });
}
