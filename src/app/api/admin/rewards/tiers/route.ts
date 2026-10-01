import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { rewardsReferralsAdminErrorResponse } from "@/lib/api/rewards-referrals-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createTier, listTiersForAdmin } from "@/services/rewards.service";
import { tierSchema } from "@/validation/rewards-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const tiers = await listTiersForAdmin(session.user.id);
    return NextResponse.json({ tiers });
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "GET /api/admin/rewards/tiers");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = tierSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const tier = await createTier(session.user.id, parsed.data);
    return NextResponse.json(tier, { status: 201 });
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "POST /api/admin/rewards/tiers");
  }
}
