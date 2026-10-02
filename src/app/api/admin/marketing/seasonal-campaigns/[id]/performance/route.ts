import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { seasonalCampaignAdminErrorResponse } from "@/lib/api/seasonal-campaign-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getSeasonalCampaignPerformanceSummary } from "@/services/seasonal-campaign.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const summary = await getSeasonalCampaignPerformanceSummary(session.user.id, id);
    return NextResponse.json(summary);
  } catch (error) {
    return seasonalCampaignAdminErrorResponse(error, "GET /api/admin/marketing/seasonal-campaigns/[id]/performance");
  }
}
