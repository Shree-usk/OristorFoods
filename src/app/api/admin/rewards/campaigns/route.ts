import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { rewardsReferralsAdminErrorResponse } from "@/lib/api/rewards-referrals-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createCampaign, listCampaignsForAdmin } from "@/services/reward-campaign.service";
import { campaignSchema } from "@/validation/reward-campaign.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const campaigns = await listCampaignsForAdmin(session.user.id);
    return NextResponse.json({ campaigns });
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "GET /api/admin/rewards/campaigns");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = campaignSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const campaign = await createCampaign(session.user.id, { ...parsed.data, targetCustomerGroup: parsed.data.targetCustomerGroup ?? null });
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "POST /api/admin/rewards/campaigns");
  }
}
