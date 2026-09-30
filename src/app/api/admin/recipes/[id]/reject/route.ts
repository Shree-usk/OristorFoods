import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { recipeAdminErrorResponse } from "@/lib/api/recipe-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { reject } from "@/services/recipe-admin.service";
import { rejectRecipeSchema } from "@/validation/recipe-admin.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = rejectRecipeSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const recipe = await reject(session.user.id, id, parsed.data.comment);
    return NextResponse.json(recipe);
  } catch (error) {
    return recipeAdminErrorResponse(error, "POST /api/admin/recipes/[id]/reject");
  }
}
