import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { setCustomerGroupPrice } from "@/services/product-admin.service";
import { setCustomerGroupPriceSchema } from "@/validation/product-admin.schema";

/** Covers the AC's "wholesale, distributor, export, private-label" tiers via CustomerGroup's own enum values — no separate models needed. Always an upsert (CustomerGroupPrice.@@unique([productId, customerGroup])). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = setCustomerGroupPriceSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const price = await setCustomerGroupPrice(session.user.id, id, parsed.data.customerGroup, parsed.data.price, parsed.data.currency);
    return NextResponse.json(price, { status: 201 });
  } catch (error) {
    return productAdminErrorResponse(error, "POST /api/admin/products/[id]/pricing/customer-group");
  }
}
