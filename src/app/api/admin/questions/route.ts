import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { qaAdminErrorResponse } from "@/lib/api/qa-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listQuestionsForAdmin } from "@/services/qa-moderation.service";
import { listQuestionsAdminQuerySchema } from "@/validation/qa-admin.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const parsed = listQuestionsAdminQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { page, pageSize, status, productId, dateFrom, dateTo, search } = parsed.data;

  try {
    const result = await listQuestionsForAdmin(session.user.id, { status, productId, dateFrom, dateTo, search }, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return qaAdminErrorResponse(error, "GET /api/admin/questions");
  }
}
