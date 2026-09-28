import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { listSavedAddresses } from "@/services/checkout.service";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Sign in to view saved addresses." }, { status: 401 });

    const addresses = await listSavedAddresses(userId);
    return NextResponse.json({ addresses });
  } catch (error) {
    return checkoutErrorResponse(error);
  }
}
