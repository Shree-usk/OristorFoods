import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { perfectMatchAdminErrorResponse } from "@/lib/api/perfect-match-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { addPerfectMatchProduct, listPerfectMatchProductsForAdmin } from "@/services/perfect-match-admin.service";
import { perfectMatchProductAdminSchema } from "@/validation/perfect-match-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listPerfectMatchProductsForAdmin(session.user.id));
  } catch (error) {
    return perfectMatchAdminErrorResponse(error, "GET /api/admin/perfect-match/products");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = perfectMatchProductAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const product = await addPerfectMatchProduct(session.user.id, parsed.data);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return perfectMatchAdminErrorResponse(error, "POST /api/admin/perfect-match/products");
  }
}
