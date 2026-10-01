import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { recipeQaAdminErrorResponse } from "@/lib/api/recipe-qa-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { reject } from "@/services/recipe-qa-moderation.service";
import { rejectRecipeQuestionSchema } from "@/validation/recipe-qa-admin.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = rejectRecipeQuestionSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const item = await reject(session.user.id, id, parsed.data.reason);
    return NextResponse.json(item);
  } catch (error) {
    return recipeQaAdminErrorResponse(error, "POST /api/admin/recipe-questions/[id]/reject");
  }
}
