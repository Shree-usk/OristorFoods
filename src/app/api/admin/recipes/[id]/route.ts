import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { recipeAdminErrorResponse } from "@/lib/api/recipe-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteRecipe, getRecipeForAdmin, updateRecipe } from "@/services/recipe-admin.service";
import { recipeAdminSchema } from "@/validation/recipe-admin.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const recipe = await getRecipeForAdmin(session.user.id, id);
    return NextResponse.json(recipe);
  } catch (error) {
    return recipeAdminErrorResponse(error, "GET /api/admin/recipes/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = recipeAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const recipe = await updateRecipe(session.user.id, id, parsed.data);
    return NextResponse.json(recipe);
  } catch (error) {
    return recipeAdminErrorResponse(error, "PATCH /api/admin/recipes/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteRecipe(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return recipeAdminErrorResponse(error, "DELETE /api/admin/recipes/[id]");
  }
}
