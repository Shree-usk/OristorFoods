import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { recipeAdminErrorResponse } from "@/lib/api/recipe-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createRecipe, listRecipesForAdmin } from "@/services/recipe-admin.service";
import { listRecipesQuerySchema, recipeAdminSchema } from "@/validation/recipe-admin.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const parsed = listRecipesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { page, pageSize, status, search } = parsed.data;

  try {
    const result = await listRecipesForAdmin(session.user.id, { status, search }, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return recipeAdminErrorResponse(error, "GET /api/admin/recipes");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = recipeAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const recipe = await createRecipe(session.user.id, parsed.data);
    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    return recipeAdminErrorResponse(error, "POST /api/admin/recipes");
  }
}
