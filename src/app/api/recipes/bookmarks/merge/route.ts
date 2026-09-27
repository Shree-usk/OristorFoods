import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { mergeGuestBookmarks } from "@/services/recipe-bookmark.service";
import { mergeRecipeBookmarksSchema } from "@/validation/recipe-bookmark.schema";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => null);
  const parsed = mergeRecipeBookmarksSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  await mergeGuestBookmarks(session.user.id, parsed.data.recipeIds);
  return NextResponse.json({ merged: true }, { status: 200 });
}
