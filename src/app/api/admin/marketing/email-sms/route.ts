import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { campaignAdminErrorResponse } from "@/lib/api/campaign-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createCampaign, listCampaignsForAdmin } from "@/services/email-sms-campaign.service";
import { campaignSchema } from "@/validation/campaign.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const campaigns = await listCampaignsForAdmin(session.user.id);
    return NextResponse.json({ campaigns });
  } catch (error) {
    return campaignAdminErrorResponse(error, "GET /api/admin/marketing/email-sms");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = campaignSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const campaign = await createCampaign(session.user.id, {
      name: parsed.data.name,
      channel: parsed.data.channel,
      audienceTarget: parsed.data.audienceTarget,
      targetCustomerGroup: parsed.data.targetCustomerGroup ?? null,
      targetSegmentId: parsed.data.targetSegmentId ?? null,
      subject: parsed.data.subject ?? null,
      body: parsed.data.body,
      scheduledAt: parsed.data.scheduledAt ?? null,
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    return campaignAdminErrorResponse(error, "POST /api/admin/marketing/email-sms");
  }
}
