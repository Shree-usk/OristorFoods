import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { customerAdminErrorResponse } from "@/lib/api/customer-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listCustomersForAdmin } from "@/services/customer-admin.service";
import { listCustomersAdminQuerySchema } from "@/validation/customer-admin.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const parsed = listCustomersAdminQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { page, pageSize, status, search, registeredFrom, registeredTo } = parsed.data;

  try {
    const result = await listCustomersForAdmin(session.user.id, { status, search, registeredFrom, registeredTo }, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return customerAdminErrorResponse(error, "GET /api/admin/customers");
  }
}
