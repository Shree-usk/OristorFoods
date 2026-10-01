import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { qaAdminErrorResponse } from "@/lib/api/qa-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { bulkModerate } from "@/services/qa-moderation.service";
import { bulkQaModerationSchema } from "@/validation/qa-admin.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bulkQaModerationSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const result = await bulkModerate(session.user.id, parsed.data.ids, parsed.data.action);
    return NextResponse.json(result);
  } catch (error) {
    return qaAdminErrorResponse(error, "POST /api/admin/questions/bulk");
  }
}
