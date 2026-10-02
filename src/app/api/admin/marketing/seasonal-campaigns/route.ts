import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { seasonalCampaignAdminErrorResponse } from "@/lib/api/seasonal-campaign-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createSeasonalCampaign, listSeasonalCampaignsForAdmin } from "@/services/seasonal-campaign.service";
import { seasonalCampaignSchema } from "@/validation/seasonal-campaign.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const campaigns = await listSeasonalCampaignsForAdmin(session.user.id);
    return NextResponse.json({ campaigns });
  } catch (error) {
    return seasonalCampaignAdminErrorResponse(error, "GET /api/admin/marketing/seasonal-campaigns");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = seasonalCampaignSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const campaign = await createSeasonalCampaign(session.user.id, {
      name: parsed.data.name,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      popupId: parsed.data.popupId ?? null,
      couponId: parsed.data.couponId ?? null,
      emailSmsCampaignId: parsed.data.emailSmsCampaignId ?? null,
      homepageSectionId: parsed.data.homepageSectionId ?? null,
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    return seasonalCampaignAdminErrorResponse(error, "POST /api/admin/marketing/seasonal-campaigns");
  }
}
