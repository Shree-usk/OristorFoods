import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { listBookmarksForCustomer } from "@/services/recipe-bookmark.service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const items = await listBookmarksForCustomer(session.user.id);
  return NextResponse.json({ items }, { status: 200 });
}
