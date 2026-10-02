import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { seasonalCampaignAdminErrorResponse } from "@/lib/api/seasonal-campaign-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getSeasonalCampaignAdminDetail, updateSeasonalCampaign } from "@/services/seasonal-campaign.service";
import { seasonalCampaignUpdateSchema } from "@/validation/seasonal-campaign.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const campaign = await getSeasonalCampaignAdminDetail(session.user.id, id);
    return NextResponse.json(campaign);
  } catch (error) {
    return seasonalCampaignAdminErrorResponse(error, "GET /api/admin/marketing/seasonal-campaigns/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = seasonalCampaignUpdateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const campaign = await updateSeasonalCampaign(session.user.id, id, parsed.data);
    return NextResponse.json(campaign);
  } catch (error) {
    return seasonalCampaignAdminErrorResponse(error, "PATCH /api/admin/marketing/seasonal-campaigns/[id]");
  }
}
