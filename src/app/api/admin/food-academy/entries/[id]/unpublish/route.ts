import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { foodAcademyAdminErrorResponse } from "@/lib/api/food-academy-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { unpublishFoodAcademyEntry } from "@/services/food-academy-admin.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await unpublishFoodAcademyEntry(session.user.id, id));
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "POST /api/admin/food-academy/entries/[id]/unpublish");
  }
}
