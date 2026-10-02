import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { campaignAdminErrorResponse } from "@/lib/api/campaign-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getCampaignAdminDetail, updateCampaign } from "@/services/email-sms-campaign.service";
import { campaignUpdateSchema } from "@/validation/campaign.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const campaign = await getCampaignAdminDetail(session.user.id, id);
    return NextResponse.json(campaign);
  } catch (error) {
    return campaignAdminErrorResponse(error, "GET /api/admin/marketing/email-sms/[id]");
  }
}

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
    return campaignAdminErrorResponse(error, "PATCH /api/admin/marketing/email-sms/[id]");
  }
}
