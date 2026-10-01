import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { rewardsReferralsAdminErrorResponse } from "@/lib/api/rewards-referrals-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { updateBadge } from "@/services/rewards.service";
import { badgeUpdateSchema } from "@/validation/rewards-admin.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = badgeUpdateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const badge = await updateBadge(session.user.id, id, parsed.data);
    return NextResponse.json(badge);
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "PATCH /api/admin/rewards/badges/[id]");
  }
}
