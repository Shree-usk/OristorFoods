import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { rewardsReferralsAdminErrorResponse } from "@/lib/api/rewards-referrals-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import * as referralRepository from "@/repositories/referral.repository";
import { requirePermission } from "@/services/permission.service";
import { updateReferralSetting } from "@/services/referral.service";
import { updateReferralSettingSchema } from "@/validation/referral-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    await requirePermission(session.user.id, "RewardsReferrals", "View");
    const setting = await referralRepository.getSetting();
    return NextResponse.json(setting ?? {});
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "GET /api/admin/referrals/settings");
  }
}

export async function PATCH(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateReferralSettingSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const updated = await updateReferralSetting(session.user.id, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "PATCH /api/admin/referrals/settings");
  }
}
