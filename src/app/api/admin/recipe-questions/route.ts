import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { recipeQaAdminErrorResponse } from "@/lib/api/recipe-qa-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listQuestionsForAdmin } from "@/services/recipe-qa-moderation.service";
import { listRecipeQuestionsAdminQuerySchema } from "@/validation/recipe-qa-admin.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const parsed = listRecipeQuestionsAdminQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { page, pageSize, status, recipeId, dateFrom, dateTo, search } = parsed.data;

  try {
    const result = await listQuestionsForAdmin(session.user.id, { status, recipeId, dateFrom, dateTo, search }, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return recipeQaAdminErrorResponse(error, "GET /api/admin/recipe-questions");
  }
}
