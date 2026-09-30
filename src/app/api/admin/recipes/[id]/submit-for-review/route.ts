import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { recipeAdminErrorResponse } from "@/lib/api/recipe-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { submitForReview } from "@/services/recipe-admin.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const recipe = await submitForReview(session.user.id, id);
    return NextResponse.json(recipe);
  } catch (error) {
    return recipeAdminErrorResponse(error, "POST /api/admin/recipes/[id]/submit-for-review");
  }
}
