import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { setStandardPrice } from "@/services/product-admin.service";
import { setStandardPriceSchema } from "@/validation/product-admin.schema";

/** Always creates a new row — StandardPrice is an append-only ledger ("latest wins" on read); see pricing.repository.ts's doc comment. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = setStandardPriceSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const price = await setStandardPrice(session.user.id, id, parsed.data.price, parsed.data.currency);
    return NextResponse.json(price, { status: 201 });
  } catch (error) {
    return productAdminErrorResponse(error, "POST /api/admin/products/[id]/pricing/standard");
  }
}
