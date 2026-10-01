import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { customerAdminErrorResponse } from "@/lib/api/customer-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { reactivateCustomer } from "@/services/customer-admin.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const customer = await reactivateCustomer(session.user.id, id);
    return NextResponse.json(customer);
  } catch (error) {
    return customerAdminErrorResponse(error, "POST /api/admin/customers/[id]/reactivate");
  }
}
