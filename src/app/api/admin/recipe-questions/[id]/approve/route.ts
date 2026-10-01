import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { recipeQaAdminErrorResponse } from "@/lib/api/recipe-qa-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { approve } from "@/services/recipe-qa-moderation.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const item = await approve(session.user.id, id);
    return NextResponse.json(item);
  } catch (error) {
    return recipeQaAdminErrorResponse(error, "POST /api/admin/recipe-questions/[id]/approve");
  }
}
