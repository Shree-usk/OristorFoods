import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { foodAcademyAdminErrorResponse } from "@/lib/api/food-academy-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteFoodAcademyCategory, getFoodAcademyCategoryForAdmin, updateFoodAcademyCategory } from "@/services/food-academy-admin.service";
import { foodAcademyCategoryAdminSchema } from "@/validation/food-academy-admin.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await getFoodAcademyCategoryForAdmin(session.user.id, id));
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "GET /api/admin/food-academy/categories/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = foodAcademyCategoryAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateFoodAcademyCategory(session.user.id, id, parsed.data));
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "PATCH /api/admin/food-academy/categories/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteFoodAcademyCategory(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "DELETE /api/admin/food-academy/categories/[id]");
  }
}
