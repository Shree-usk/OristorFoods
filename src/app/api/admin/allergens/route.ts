import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productTaxonomyErrorResponse } from "@/lib/api/product-taxonomy-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createAllergenAdmin, listAllergensForAdmin } from "@/services/product-taxonomy.service";
import { allergenAdminSchema } from "@/validation/product-taxonomy.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listAllergensForAdmin(session.user.id));
  } catch (error) {
    return productTaxonomyErrorResponse(error, "GET /api/admin/allergens");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = allergenAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const allergen = await createAllergenAdmin(session.user.id, parsed.data);
    return NextResponse.json(allergen, { status: 201 });
  } catch (error) {
    return productTaxonomyErrorResponse(error, "POST /api/admin/allergens");
  }
}
