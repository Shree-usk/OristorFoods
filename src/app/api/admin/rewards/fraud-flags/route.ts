import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { rewardsReferralsAdminErrorResponse } from "@/lib/api/rewards-referrals-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listFraudFlags } from "@/services/fraud-detection.service";
import { fraudFlagStatusEnum } from "@/validation/fraud-flag.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get("status") ?? undefined;
  const statusParsed = rawStatus ? fraudFlagStatusEnum.safeParse(rawStatus) : undefined;
  if (rawStatus && !statusParsed?.success) return validationErrorResponse(statusParsed!.error);
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "20") || 20;

  try {
    const result = await listFraudFlags(session.user.id, statusParsed?.data, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "GET /api/admin/rewards/fraud-flags");
  }
}
