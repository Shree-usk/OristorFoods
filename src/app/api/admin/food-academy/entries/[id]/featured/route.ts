import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { foodAcademyAdminErrorResponse } from "@/lib/api/food-academy-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { toggleFoodAcademyEntryFeatured } from "@/services/food-academy-admin.service";
import { foodAcademyEntryFeaturedSchema } from "@/validation/food-academy-admin.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = foodAcademyEntryFeaturedSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await toggleFoodAcademyEntryFeatured(session.user.id, id, parsed.data.isFeatured));
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "PATCH /api/admin/food-academy/entries/[id]/featured");
  }
}
