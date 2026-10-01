import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { rewardsReferralsAdminErrorResponse } from "@/lib/api/rewards-referrals-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { approveFlag } from "@/services/fraud-detection.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const flag = await approveFlag(session.user.id, id);
    return NextResponse.json(flag);
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "POST /api/admin/rewards/fraud-flags/[id]/approve");
  }
}
