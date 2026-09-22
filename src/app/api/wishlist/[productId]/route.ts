import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { removeFromWishlist } from "@/services/wishlist.service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId } = await params;
  await removeFromWishlist(session.user.id, productId);
  return NextResponse.json({ removed: true }, { status: 200 });
}
