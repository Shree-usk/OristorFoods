import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { rewardsReferralsAdminErrorResponse } from "@/lib/api/rewards-referrals-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { updateTier } from "@/services/rewards.service";
import { tierUpdateSchema } from "@/validation/rewards-admin.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = tierUpdateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const tier = await updateTier(session.user.id, id, parsed.data);
    return NextResponse.json(tier);
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "PATCH /api/admin/rewards/tiers/[id]");
  }
}
