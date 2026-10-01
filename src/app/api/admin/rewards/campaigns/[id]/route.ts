import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { rewardsReferralsAdminErrorResponse } from "@/lib/api/rewards-referrals-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { updateCampaign } from "@/services/reward-campaign.service";
import { campaignUpdateSchema } from "@/validation/reward-campaign.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = campaignUpdateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const campaign = await updateCampaign(session.user.id, id, parsed.data);
    return NextResponse.json(campaign);
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "PATCH /api/admin/rewards/campaigns/[id]");
  }
}
