import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { rewardsReferralsAdminErrorResponse } from "@/lib/api/rewards-referrals-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createBadge, listBadgesForAdmin } from "@/services/rewards.service";
import { badgeSchema } from "@/validation/rewards-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const badges = await listBadgesForAdmin(session.user.id);
    return NextResponse.json({ badges });
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "GET /api/admin/rewards/badges");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = badgeSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const badge = await createBadge(session.user.id, { ...parsed.data, description: parsed.data.description ?? null, threshold: parsed.data.threshold ?? null });
    return NextResponse.json(badge, { status: 201 });
  } catch (error) {
    return rewardsReferralsAdminErrorResponse(error, "POST /api/admin/rewards/badges");
  }
}
