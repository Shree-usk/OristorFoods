import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { customerAdminErrorResponse } from "@/lib/api/customer-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getCustomerAdminDetail } from "@/services/customer-admin.service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = Number(searchParams.get("pageSize") ?? "10") || 10;

  try {
    const detail = await getCustomerAdminDetail(session.user.id, id, page, pageSize);
    return NextResponse.json(detail);
  } catch (error) {
    return customerAdminErrorResponse(error, "GET /api/admin/customers/[id]");
  }
}
