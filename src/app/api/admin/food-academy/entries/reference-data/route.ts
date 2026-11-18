import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { foodAcademyAdminErrorResponse } from "@/lib/api/food-academy-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getFoodAcademyFormReferenceData } from "@/services/food-academy-admin.service";

/** Categories for the entry editor's category dropdown. */
export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getFoodAcademyFormReferenceData(session.user.id));
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "GET /api/admin/food-academy/entries/reference-data");
  }
}
