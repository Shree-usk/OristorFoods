import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { upsertCampaignPrice } from "@/services/product-admin.service";
import { upsertCampaignPriceSchema } from "@/validation/product-admin.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = upsertCampaignPriceSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const price = await upsertCampaignPrice(session.user.id, id, parsed.data.id ?? null, parsed.data);
    return NextResponse.json(price, { status: 201 });
  } catch (error) {
    return productAdminErrorResponse(error, "POST /api/admin/products/[id]/pricing/campaign");
  }
}
