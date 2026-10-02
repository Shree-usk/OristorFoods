import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { rewardsReferralsAdminErrorResponse } from "@/lib/api/rewards-referrals-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { requirePermission } from "@/services/permission.service";
import * as rewardsRepository from "@/repositories/rewards.repository";
import { updateRewardSetting } from "@/services/rewards.service";
import { updateRewardSettingSchema } from "@/validation/rewards-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    await requirePermission(session.user.id, "RewardsReferrals", "View");
    const setting = await rewardsRepository.getSetting();
    return NextResponse.json(setting ?? {});
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "GET /api/admin/rewards/settings");
  }
}

export async function PATCH(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateRewardSettingSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const updated = await updateRewardSetting(session.user.id, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "PATCH /api/admin/rewards/settings");
  }
}
