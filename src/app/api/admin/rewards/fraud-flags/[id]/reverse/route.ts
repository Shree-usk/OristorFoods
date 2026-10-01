import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { rewardsReferralsAdminErrorResponse } from "@/lib/api/rewards-referrals-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { reverseFlag } from "@/services/fraud-detection.service";
import { reverseFlagSchema } from "@/validation/fraud-flag.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = reverseFlagSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const flag = await reverseFlag(session.user.id, id, parsed.data.note);
    return NextResponse.json(flag);
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "POST /api/admin/rewards/fraud-flags/[id]/reverse");
  }
}
