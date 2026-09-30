import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getProductFormReferenceData } from "@/services/product-admin.service";

/** Categories/brands/collections/allergens/certifications for the product form's pickers — one call, not five. */
export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const data = await getProductFormReferenceData(session.user.id);
    return NextResponse.json(data);
  } catch (error) {
    return productAdminErrorResponse(error, "GET /api/admin/products/reference-data");
  }
}
