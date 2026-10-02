import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { campaignAdminErrorResponse } from "@/lib/api/campaign-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { processDueCampaigns } from "@/services/email-sms-campaign.service";

export async function POST() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const result = await processDueCampaigns(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    return campaignAdminErrorResponse(error, "POST /api/admin/marketing/email-sms/process-due");
  }
}
