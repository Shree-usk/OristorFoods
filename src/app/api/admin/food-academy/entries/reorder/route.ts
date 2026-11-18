import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { foodAcademyAdminErrorResponse } from "@/lib/api/food-academy-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { reorderFoodAcademyFeaturedEntries } from "@/services/food-academy-admin.service";
import { foodAcademyReorderSchema } from "@/validation/food-academy-admin.schema";

/** Reorders only currently-featured entries — see reorderFoodAcademyFeaturedEntries's own guard against stray ids. */
export async function PATCH(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = foodAcademyReorderSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await reorderFoodAcademyFeaturedEntries(session.user.id, parsed.data.orderedIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "PATCH /api/admin/food-academy/entries/reorder");
  }
}
