import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createProduct, listProductsForAdmin } from "@/services/product-admin.service";
import { listProductsQuerySchema, productAdminSchema } from "@/validation/product-admin.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const parsed = listProductsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { page, pageSize, status, categoryId, stockLevel, search } = parsed.data;

  try {
    const result = await listProductsForAdmin(session.user.id, { status, categoryId, stockLevel, search }, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return productAdminErrorResponse(error, "GET /api/admin/products");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = productAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const product = await createProduct(session.user.id, parsed.data);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return productAdminErrorResponse(error, "POST /api/admin/products");
  }
}
