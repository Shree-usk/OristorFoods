import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { addBookmark, removeBookmark } from "@/services/recipe-bookmark.service";
import { RecipeBookmarkServiceError } from "@/services/recipe-bookmark.errors";

type RouteContext = { params: Promise<{ slug: string }> };

function bookmarkErrorResponse(error: unknown) {
  if (error instanceof RecipeBookmarkServiceError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  throw error;
}

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  try {
    await addBookmark(session.user.id, slug);
    return NextResponse.json({ bookmarked: true }, { status: 200 });
  } catch (error) {
    return bookmarkErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  try {
    await removeBookmark(session.user.id, slug);
    return NextResponse.json({ removed: true }, { status: 200 });
  } catch (error) {
    return bookmarkErrorResponse(error);
  }
}
