import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { customerAdminErrorResponse } from "@/lib/api/customer-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { grantReward } from "@/services/customer-admin.service";
import { grantRewardSchema } from "@/validation/customer-admin.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = grantRewardSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await grantReward(session.user.id, id, parsed.data.points, parsed.data.reason, parsed.data.expiresAt ?? null);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return customerAdminErrorResponse(error, "POST /api/admin/customers/[id]/rewards/grant");
  }
}
