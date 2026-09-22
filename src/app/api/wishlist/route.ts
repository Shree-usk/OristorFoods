import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { addToWishlist, getWishlist } from "@/services/wishlist.service";
import { addWishlistItemSchema } from "@/validation/wishlist.schema";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await getWishlist(session.user.id);
  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = addWishlistItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  await addToWishlist(session.user.id, parsed.data.productId);
  return NextResponse.json({ added: true }, { status: 200 });
}
