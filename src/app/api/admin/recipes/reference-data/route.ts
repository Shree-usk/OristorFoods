import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { recipeAdminErrorResponse } from "@/lib/api/recipe-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getRecipeFormReferenceData } from "@/services/recipe-admin.service";

/** Categories/dietary tags for the recipe form's pickers — one call, not two. "Shop this ingredient" reuses the existing admin products list/search endpoint instead of duplicating it here. */
export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const data = await getRecipeFormReferenceData(session.user.id);
    return NextResponse.json(data);
  } catch (error) {
    return recipeAdminErrorResponse(error, "GET /api/admin/recipes/reference-data");
  }
}
