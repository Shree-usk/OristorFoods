import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { campaignAdminErrorResponse } from "@/lib/api/campaign-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { sendCampaignNow } from "@/services/email-sms-campaign.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const campaign = await sendCampaignNow(session.user.id, id);
    return NextResponse.json(campaign);
  } catch (error) {
    return campaignAdminErrorResponse(error, "POST /api/admin/marketing/email-sms/[id]/send");
  }
}
