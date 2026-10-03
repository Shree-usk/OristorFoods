import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { crmSegmentationErrorResponse } from "@/lib/api/crm-segmentation-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { listRewardTiersForSegmentation } from "@/services/crm-segmentation.service";

/** STORY-059a. A minimal reward-tier list for the segment builder's tier picker — scoped to CRMAnalytics:View, not RewardsReferrals:View. */
export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listRewardTiersForSegmentation(session.user.id));
  } catch (error) {
    return crmSegmentationErrorResponse(error, "GET /api/admin/crm/reward-tiers");
  }
}
