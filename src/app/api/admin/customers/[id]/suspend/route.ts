import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { customerAdminErrorResponse } from "@/lib/api/customer-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { suspendCustomer } from "@/services/customer-admin.service";
import { suspendCustomerSchema } from "@/validation/customer-admin.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = suspendCustomerSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const customer = await suspendCustomer(session.user.id, id, parsed.data.reason);
    return NextResponse.json(customer);
  } catch (error) {
    return customerAdminErrorResponse(error, "POST /api/admin/customers/[id]/suspend");
  }
}
