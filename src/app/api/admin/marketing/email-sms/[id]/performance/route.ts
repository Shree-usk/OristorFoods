import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { campaignAdminErrorResponse } from "@/lib/api/campaign-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getCampaignDeliverySummary } from "@/services/email-sms-campaign.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const summary = await getCampaignDeliverySummary(session.user.id, id);
    return NextResponse.json(summary);
  } catch (error) {
    return campaignAdminErrorResponse(error, "GET /api/admin/marketing/email-sms/[id]/performance");
  }
}
