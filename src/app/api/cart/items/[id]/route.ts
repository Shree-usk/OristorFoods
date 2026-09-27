import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { cartErrorResponse } from "@/lib/api/cart-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { readCartCookie } from "@/lib/api/cart-cookie";
import { removeItem, updateItemQuantity } from "@/services/cart.service";
import { updateCartItemSchema } from "@/validation/cart.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = updateCartItemSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    await updateItemQuantity(userId, guestCookieValue, id, parsed.data.quantity);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return cartErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    const guestCookieValue = readCartCookie(request);

    await removeItem(userId, guestCookieValue, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return cartErrorResponse(error);
  }
}
