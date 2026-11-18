import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { foodAcademyAdminErrorResponse } from "@/lib/api/food-academy-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteFoodAcademyEntry, getFoodAcademyEntryForAdmin, updateFoodAcademyEntry } from "@/services/food-academy-admin.service";
import { foodAcademyEntryAdminSchema } from "@/validation/food-academy-admin.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await getFoodAcademyEntryForAdmin(session.user.id, id));
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "GET /api/admin/food-academy/entries/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = foodAcademyEntryAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateFoodAcademyEntry(session.user.id, id, parsed.data));
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "PATCH /api/admin/food-academy/entries/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteFoodAcademyEntry(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "DELETE /api/admin/food-academy/entries/[id]");
  }
}
