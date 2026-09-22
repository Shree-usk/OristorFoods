import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { mergeGuestWishlist } from "@/services/wishlist.service";
import { mergeWishlistSchema } from "@/validation/wishlist.schema";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = mergeWishlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await mergeGuestWishlist(session.user.id, parsed.data.productIds);
  return NextResponse.json({ merged: true }, { status: 200 });
}
