import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { recipeQaAdminErrorResponse } from "@/lib/api/recipe-qa-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { bulkModerate } from "@/services/recipe-qa-moderation.service";
import { bulkRecipeQaModerationSchema } from "@/validation/recipe-qa-admin.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bulkRecipeQaModerationSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const result = await bulkModerate(session.user.id, parsed.data.ids, parsed.data.action);
    return NextResponse.json(result);
  } catch (error) {
    return recipeQaAdminErrorResponse(error, "POST /api/admin/recipe-questions/bulk");
  }
}
