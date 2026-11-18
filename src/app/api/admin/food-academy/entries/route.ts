import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { foodAcademyAdminErrorResponse } from "@/lib/api/food-academy-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createFoodAcademyEntry, listFoodAcademyEntriesForAdmin } from "@/services/food-academy-admin.service";
import { foodAcademyEntryAdminSchema, listFoodAcademyEntriesQuerySchema } from "@/validation/food-academy-admin.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const parsed = listFoodAcademyEntriesQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { page, pageSize, status, categoryId, search } = parsed.data;

  try {
    const result = await listFoodAcademyEntriesForAdmin(session.user.id, { status, categoryId, search }, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "GET /api/admin/food-academy/entries");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = foodAcademyEntryAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const entry = await createFoodAcademyEntry(session.user.id, parsed.data);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "POST /api/admin/food-academy/entries");
  }
}
