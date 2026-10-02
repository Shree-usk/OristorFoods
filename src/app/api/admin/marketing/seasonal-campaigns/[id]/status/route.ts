import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { seasonalCampaignAdminErrorResponse } from "@/lib/api/seasonal-campaign-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { changeSeasonalCampaignStatus } from "@/services/seasonal-campaign.service";
import { updateSeasonalCampaignStatusSchema } from "@/validation/seasonal-campaign.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateSeasonalCampaignStatusSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const campaign = await changeSeasonalCampaignStatus(session.user.id, id, parsed.data.status);
    return NextResponse.json(campaign);
  } catch (error) {
    return seasonalCampaignAdminErrorResponse(error, "POST /api/admin/marketing/seasonal-campaigns/[id]/status");
  }
}
